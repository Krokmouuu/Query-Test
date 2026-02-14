import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { MAX_NL_QUERY_LENGTH, MAX_SQL_LENGTH } from "./dto/query.dto";
import { SCHEMA_CONTEXT } from "./schema-context";

const MAX_LLM_RETRIES = 5;

const FORBIDDEN_PATTERNS = [
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+\w+\s+SET\b/i,
  /\bALTER\b/i,
  /\bCREATE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /;\s*SELECT/i,
  /;\s*--/i,
  /--.*\n.*SELECT/i,
];

@Injectable()
export class QueryService {
  private openai: OpenAI | null = null;
  private readonly logger = new Logger(QueryService.name);

  constructor() {
    const key = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;
    if (key || baseURL) {
      this.openai = new OpenAI({
        apiKey: key || "ollama",
        baseURL: baseURL || undefined,
      });
    }
  }

  private hasTableAliasAtTopLevel(
    s: string,
    tableName: string,
    alias: string,
  ): boolean {
    const re = new RegExp(`\\b${tableName}\\s+(?:AS\\s+)?${alias}\\b`, "gi");
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((match = re.exec(s)) !== null) {
      let level = 0;
      for (let i = 0; i < match.index; i++) {
        if (s[i] === "'" && s[i - 1] !== "\\") {
          i++;
          while (i < match.index && (s[i] !== "'" || s[i - 1] === "\\")) i++;
          continue;
        }
        if (s[i] === "(") level++;
        else if (s[i] === ")") level--;
      }
      if (level === 0) return true;
    }
    return false;
  }

  private truncateAtStatementEnd(sql: string): string {
    let inString = false;
    let i = 0;
    const n = sql.length;
    while (i < n) {
      const c = sql[i];
      if (c === "'" && sql[i - 1] !== "\\") {
        inString = !inString;
        i++;
        continue;
      }
      if (!inString && c === ";") {
        return sql.slice(0, i + 1).trim();
      }
      i++;
    }
    return sql.trim();
  }

  private getMainFromClause(sqlQuery: string): string {
    const fromIdx = sqlQuery.search(/\bFROM\b/i);
    if (fromIdx < 0) return "";
    let level = 0;
    let i = fromIdx;
    const n = sqlQuery.length;
    while (i < n) {
      const c = sqlQuery[i];
      if (c === "'" && sqlQuery[i - 1] !== "\\") {
        i++;
        while (i < n && (sqlQuery[i] !== "'" || sqlQuery[i - 1] === "\\")) i++;
        i++;
        continue;
      }
      if (c === "(") level++;
      else if (c === ")") level--;
      else if (level === 0 && /^\s+WHERE\b/i.test(sqlQuery.slice(i)))
        return sqlQuery.slice(fromIdx, i);
      i++;
    }
    return sqlQuery.slice(fromIdx);
  }

  private moveAggregateFromWhereToHaving(sqlQuery: string): string {
    const aggRegex =
      /\b(COUNT|SUM|AVG|MIN|MAX)\s*\([^)]*\)\s*(>=|<=|!=|>|<|=|<>)\s*(?:'[^']*'|\(\d+\)|\d+)/i;
    const aggMatch = sqlQuery.match(aggRegex);
    if (!aggMatch) return sqlQuery;
    const aggCond = aggMatch[0];
    const aliasInAgg = aggCond.match(/\b(\w+)\.\w+/);
    if (aliasInAgg) {
      const alias = aliasInAgg[1];
      const fromClause = this.getMainFromClause(sqlQuery);
      const tableForAlias: Record<string, string> = {
        o: "organizations",
        v: "visits",
        p: "patients",
        d: "doctors",
        f: "facilities",
        i: "insurances",
      };
      const expectedTable = tableForAlias[alias.toLowerCase()];
      const hasAliasInFrom = expectedTable
        ? this.hasTableAliasAtTopLevel(fromClause, expectedTable, alias)
        : new RegExp(`(?:JOIN|FROM)\\s+\\w+\\s+${alias}\\b`, "i").test(
            fromClause,
          ) ||
          new RegExp(`(?:JOIN|FROM)\\s+\\w+\\s+AS\\s+${alias}\\b`, "i").test(
            fromClause,
          );
      if (!hasAliasInFrom) return sqlQuery;
    }
    const escapedAgg = aggCond.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`\\s+AND\\s+${escapedAgg}\\s*`, "gi"),
      new RegExp(`\\s+${escapedAgg}\\s+AND\\s+`, "gi"),
      new RegExp(`WHERE\\s+${escapedAgg}\\s+`, "gi"),
      new RegExp(`WHERE\\s*\\(\\s*${escapedAgg}\\s*\\)\\s*`, "gi"),
    ];
    let cleaned = sqlQuery;
    let removedFromWhere = false;
    for (const re of patterns) {
      const next = cleaned.replace(re, (m) => {
        removedFromWhere = true;
        return /^\s*WHERE/i.test(m) ? "WHERE " : " ";
      });
      cleaned = next;
    }
    if (!removedFromWhere) return sqlQuery;
    cleaned = cleaned.replace(/WHERE\s*\(\s*/i, "WHERE ");
    cleaned = cleaned.replace(
      /\s*\)\s*(?=\s*(?:ORDER\s+BY|LIMIT\s+|\s*$))/im,
      " ",
    );
    cleaned = cleaned.replace(/\bWHERE\s+(GROUP\s+BY|\bORDER\s+BY)/gi, "$1");
    cleaned = cleaned.replace(/\s+WHERE\s*$/im, " ");
    cleaned = cleaned.replace(/\s+WHERE\s+(ORDER\s+BY|\s+LIMIT\s+)/gi, " $1");
    if (/\bHAVING\b/i.test(cleaned)) return cleaned;

    const hasGroupBy = /\bGROUP\s+BY\b/i.test(cleaned);
    if (hasGroupBy) {
      cleaned = cleaned.replace(
        /(\bGROUP\s+BY\s+[\s\S]+?)(\s+ORDER\s+BY|\s+LIMIT\s+|\s*$)/i,
        (_, groupByPart, rest) => `${groupByPart} HAVING ${aggCond}${rest}`,
      );
    } else {
      const fromMatch = cleaned.match(/\bFROM\s+\w+\s+(\w+)/i);
      const alias = fromMatch ? fromMatch[1] : "id";
      cleaned = cleaned.replace(
        /(\s)(ORDER\s+BY|\s*LIMIT\s+\d+|\s*$)/is,
        (_, sp, rest) =>
          `${sp}GROUP BY ${alias}.id HAVING ${aggCond}${rest.trim() ? " " + rest.trim() : ""}`,
      );
    }
    return cleaned;
  }

  private fixMissingWithCteAs(sqlQuery: string): string {
    const trimmed = sqlQuery.trimStart();
    if (/^\s*WITH\s+/i.test(trimmed)) return sqlQuery;
    if (!/\)\s*SELECT\s+/is.test(sqlQuery) || !/\bFROM\s+cte\b/i.test(sqlQuery))
      return sqlQuery;
    return "WITH cte AS (" + sqlQuery;
  }

  /** When GROUP BY has both visit_date and reason/diagnosis, remove visit_date so we get one row per reason with correct count. */
  private fixGroupByReasonOrDiagnosisOnly(sqlQuery: string): string {
    if (!/\bGROUP\s+BY\b/i.test(sqlQuery)) return sqlQuery;
    if (!/(?:v|visits)\s*\.\s*(reason|diagnosis)\b/i.test(sqlQuery))
      return sqlQuery;
    if (!/(?:v|visits)\s*\.\s*visit_date\b/i.test(sqlQuery)) return sqlQuery;
    const visitDateCol = "(?:v|visits)\\s*\\.\\s*visit_date(?:\\s+AS\\s+\\w+)?";
    let q = sqlQuery
      .replace(new RegExp(",\\s*" + visitDateCol + "\\s*", "gi"), ",")
      .replace(new RegExp("\\s*" + visitDateCol + "\\s*,", "gi"), ",");
    q = q
      .replace(/,\s*,/g, ",")
      .replace(/\bGROUP\s+BY\s+,/gi, "GROUP BY ")
      .replace(/,\s*\)/g, " )");
    const colInSelect = "(?:v|visits)\\.visit_date(?:\\s+AS\\s+\\w+)?";
    q = q
      .replace(new RegExp(",\\s*" + colInSelect + "\\s*,\\s*", "gi"), ", ")
      .replace(new RegExp(",\\s*" + colInSelect + "\\s+FROM", "gi"), " FROM")
      .replace(new RegExp(",\\s*" + colInSelect + "\\s*$", "gim"), "")
      .replace(new RegExp("^\\s*" + colInSelect + "\\s*,\\s*", "gim"), "");
    q = q.replace(/,\s*,/g, ",").replace(/,\s+FROM/g, " FROM");
    return q;
  }

  private fixGroupByWhenSelectHasDoctorAndPatient(sqlQuery: string): string {
    if (!/\bGROUP\s+BY\b/i.test(sqlQuery)) return sqlQuery;
    if (!/\bd\.(first_name|last_name)\b/i.test(sqlQuery)) return sqlQuery;
    return sqlQuery.replace(
      /(\bGROUP\s+BY\s+[\s\S]+?)(\s+HAVING|\s+ORDER\s+BY|\s+LIMIT\s+\d+|\s*;?\s*$)/i,
      (_, groupPart, rest) => {
        if (/\bd\.(id|first_name|last_name)\b/i.test(groupPart))
          return groupPart + rest;
        const trimmed = groupPart.replace(/\s*,\s*$/, "");
        return `${trimmed}, d.id, d.first_name, d.last_name${rest}`;
      },
    );
  }

  private addExtractVisitDateAliases(sqlQuery: string): string {
    if (!/EXTRACT\s*\([^)]*visit_date/i.test(sqlQuery)) return sqlQuery;
    let q = sqlQuery.replace(
      /(EXTRACT\s*\(\s*MONTH\s+FROM\s+(?:v|visits)\s*\.\s*visit_date\s*\))(?!\s+AS\s+\w+)/i,
      "$1 AS month",
    );
    q = q.replace(
      /(EXTRACT\s*\(\s*YEAR\s+FROM\s+(?:v|visits)\s*\.\s*visit_date\s*\))(?!\s+AS\s+\w+)/i,
      "$1 AS year",
    );
    return q;
  }

  private fixFacilityDoctorVisitJoinOrder(sqlQuery: string): string {
    return sqlQuery.replace(
      /\bFROM\s+visits\s+v\s+JOIN\s+facilities\s+f\s+ON\s+v\.doctor_id\s*=\s*d\.id\s+JOIN\s+doctors\s+d\s+ON\s+d\.facility_id\s*=\s*f\.id\b/gis,
      "FROM facilities f JOIN doctors d ON d.facility_id = f.id JOIN visits v ON v.doctor_id = d.id",
    );
  }

  private fixMissingGroupByForExtractVisitDate(sqlQuery: string): string {
    if (/\bGROUP\s+BY\b/i.test(sqlQuery)) return sqlQuery;
    if (!/EXTRACT\s*\([^)]*visit_date/i.test(sqlQuery)) return sqlQuery;
    if (!/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(sqlQuery)) return sqlQuery;
    const extractRe =
      /EXTRACT\s*\(\s*\w+\s+FROM\s+(?:v|visits)\s*\.\s*visit_date\s*\)/gi;
    const exprs: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = extractRe.exec(sqlQuery)) !== null) {
      const e = m[0];
      if (!exprs.includes(e)) exprs.push(e);
    }
    if (exprs.length === 0) return sqlQuery;
    const groupByClause = " GROUP BY " + exprs.join(", ");
    let q = sqlQuery.replace(/\s+ORDER\s+BY\s+/i, (s) => groupByClause + s);
    if (q === sqlQuery)
      q = sqlQuery.replace(/\s+LIMIT\s+\d+\s*$/i, (s) => groupByClause + s);
    if (q === sqlQuery) q = sqlQuery + groupByClause;
    q = q.replace(
      /COUNT\s*\(\s*DISTINCT\s+EXTRACT\s*\(\s*\w+\s+FROM\s+(?:v|visits)\s*\.\s*visit_date\s*\)\s*\)/gi,
      "COUNT(v.id)",
    );
    return q;
  }

  private removeVisitDateFromSelectWhenGroupByExtract(
    sqlQuery: string,
  ): string {
    if (!/\bGROUP\s+BY\b/i.test(sqlQuery)) return sqlQuery;
    if (
      !/EXTRACT\s*\([^)]*visit_date/i.test(sqlQuery) &&
      !/DATE_TRUNC\s*\([^)]*visit_date/i.test(sqlQuery)
    )
      return sqlQuery;
    if (!/\b(?:v|visits)\s*\.\s*visit_date\b/i.test(sqlQuery)) return sqlQuery;
    const col = "(?:v|visits)\\s*\\.\\s*visit_date(?:\\s+AS\\s+\\w+)?";
    const patterns: [RegExp, string][] = [
      [new RegExp(",\\s*" + col + "\\s+FROM", "gis"), " FROM"],
      [new RegExp(",\\s*" + col + "\\s*,", "gis"), ","],
      [new RegExp(",\\s*" + col + "\\s*$", "gim"), ""],
      [new RegExp("^\\s*" + col + "\\s*,\\s*", "gim"), ""],
    ];
    let q = sqlQuery;
    for (const [re, repl] of patterns) {
      q = q.replace(re, repl);
    }
    for (let i = 0; i < 3; i++) {
      q = q
        .replace(/,\s*,/g, ",")
        .replace(/,\s+FROM/g, " FROM")
        .replace(/,\s*\)/g, " )");
    }
    return q;
  }

  private fixTrailingCommaBeforeParen(sqlQuery: string): string {
    let prev = "";
    while (prev !== sqlQuery) {
      prev = sqlQuery;
      sqlQuery = sqlQuery.replace(/,\s*\)/g, " )");
    }
    return sqlQuery;
  }

  private fixWhereExtractAsEquals(sqlQuery: string): string {
    return sqlQuery
      .replace(
        /\b(EXTRACT\s*\(\s*MONTH\s+FROM\s+[^)]+\))\s+AS\s+\w+\s*=\s*/gi,
        "$1 = ",
      )
      .replace(
        /\b(EXTRACT\s*\(\s*YEAR\s+FROM\s+[^)]+\))\s+AS\s+\w+\s*=\s*/gi,
        "$1 = ",
      );
  }

  private fixSemicolonBeforeGroupBy(sqlQuery: string): string {
    return sqlQuery.replace(/\s*;\s*GROUP\s+BY\b/gi, " GROUP BY");
  }

  private fixGroupByRemoveAlias(sqlQuery: string): string {
    return sqlQuery.replace(
      /\bGROUP\s+BY\s+([\s\S]+?)(?=\s+ORDER\s+BY|\s+HAVING|\s*;?\s*$)/gi,
      (_, groupByExpr) => {
        const cleaned = groupByExpr.replace(/\)\s+AS\s+\w+/g, ")");
        return `GROUP BY ${cleaned}`;
      },
    );
  }

  private fixVisitsJoinFacilityWithoutDoctors(sqlQuery: string): string {
    return sqlQuery.replace(
      /\bFROM\s+visits\s+v\s+JOIN\s+facilities\s+f\s+ON\s+v\.doctor_id\s*=\s*d\.id\s+(?:AND\s+)?v\.facility_id\s*=\s*f\.id/gi,
      "FROM visits v JOIN doctors d ON v.doctor_id = d.id JOIN facilities f ON d.facility_id = f.id",
    );
  }

  private fixGroupByFacilityPatientToTopPatientPerFacility(sqlQuery: string): string {
    const hasWrongPattern =
      /\bGROUP\s+BY\s+[\s\S]*?f\.(name|id)\b[\s\S]*?p\.(first_name|last_name|id)\b/i.test(
        sqlQuery,
      ) &&
      (/\bORDER\s+BY\s+.*?num_visits\s+DESC/is.test(sqlQuery) ||
        /\bORDER\s+BY\s+.*?COUNT\s*\(\s*v\.id\s*\)\s+DESC/is.test(sqlQuery)) &&
      /\bCOUNT\s*\(\s*v\.id\s*\)/i.test(sqlQuery) &&
      /\bFROM\s+visits\s+v\b/i.test(sqlQuery) &&
      /\bJOIN\s+facilities\s+f\b/i.test(sqlQuery) &&
      /\bJOIN\s+patients\s+p\b/i.test(sqlQuery) &&
      !/^\s*WITH\s+/i.test(sqlQuery.trim());
    if (!hasWrongPattern) return sqlQuery;
    return `WITH counts AS (
  SELECT f.id AS facility_id, f.name AS facility_name, p.id AS patient_id, p.first_name, p.last_name, COUNT(v.id) AS num_visits
  FROM visits v
  JOIN doctors d ON v.doctor_id = d.id
  JOIN facilities f ON d.facility_id = f.id
  JOIN patients p ON v.patient_id = p.id
  GROUP BY f.id, f.name, p.id, p.first_name, p.last_name
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY facility_id ORDER BY num_visits DESC) AS rn
  FROM counts
)
SELECT facility_name AS name, first_name || ' ' || last_name AS patient_name, num_visits
FROM ranked
WHERE rn = 1
ORDER BY num_visits DESC`;
  }

  private fixFacilityMultipleCountsCartesianProduct(sqlQuery: string): string {
    const wrongJoin =
      /\b(?:f\.id\s*=\s*v\.doctor_id|v\.doctor_id\s*=\s*f\.id)\b/i.test(
        sqlQuery,
      );
    if (!wrongJoin) return sqlQuery;
    const hasFacilityDoctorsPatientsVisits =
      /\bFROM\s+facilities\s+f\b/i.test(sqlQuery) &&
      /\bJOIN\s+doctors\s+d\b/i.test(sqlQuery) &&
      /\bJOIN\s+patients\s+p\b/i.test(sqlQuery) &&
      /\bJOIN\s+visits\s+v\b/i.test(sqlQuery);
    if (!hasFacilityDoctorsPatientsVisits) return sqlQuery;
    const hasGroupBy = /\bGROUP\s+BY\s+f\.(name|id)\b/i.test(sqlQuery);
    if (!hasGroupBy) return sqlQuery;
    const countMatches = sqlQuery.match(
      /SELECT\s+f\.name\s*,\s*COUNT\s*\(\s*d\.id\s*\)\s+AS\s+(\w+)\s*,\s*COUNT\s*\(\s*p\.id\s*\)\s+AS\s+(\w+)\s*,\s*COUNT\s*\(\s*v\.id\s*\)\s+AS\s+(\w+)/is,
    );
    const numDoctors = countMatches?.[1] ?? "num_doctors";
    const numPatients = countMatches?.[2] ?? "num_patients";
    const numVisits = countMatches?.[3] ?? "num_visits";
    const limitMatch = sqlQuery.match(/\bLIMIT\s+\d+\s*;?\s*$/i);
    const limitClause = limitMatch ? ` ${limitMatch[0].trim()}` : "";
    return `SELECT f.name, (SELECT COUNT(*) FROM doctors d WHERE d.facility_id = f.id) AS ${numDoctors}, (SELECT COUNT(*) FROM patients p WHERE p.facility_id = f.id) AS ${numPatients}, (SELECT COUNT(*) FROM visits v JOIN doctors d ON v.doctor_id = d.id WHERE d.facility_id = f.id) AS ${numVisits} FROM facilities f ORDER BY ${numVisits} DESC${limitClause}`;
  }

  /** Pipeline de normalisation / corrections SQL (ordre important). */
  private applySqlFixes(sql: string): string {
    const fixes: Array<(s: string) => string> = [
      (s) => this.truncateAtStatementEnd(s),
      (s) => s.replace(/`/g, ""),
      (s) => this.fixMissingWithCteAs(s),
      (s) => this.fixTrailingCommaBeforeParen(s),
      (s) => this.moveAggregateFromWhereToHaving(s),
      (s) => this.fixMissingGroupByForExtractVisitDate(s),
      (s) => this.removeVisitDateFromSelectWhenGroupByExtract(s),
      (s) => this.fixFacilityDoctorVisitJoinOrder(s),
      (s) => this.fixGroupByWhenSelectHasDoctorAndPatient(s),
      (s) => this.fixGroupByReasonOrDiagnosisOnly(s),
      (s) => this.addExtractVisitDateAliases(s),
      (s) => this.fixWhereExtractAsEquals(s),
      (s) => this.fixSemicolonBeforeGroupBy(s),
      (s) => this.fixGroupByRemoveAlias(s),
      (s) => this.fixVisitsJoinFacilityWithoutDoctors(s),
      (s) => this.fixGroupByFacilityPatientToTopPatientPerFacility(s),
      (s) => this.fixFacilityMultipleCountsCartesianProduct(s),
    ];
    return fixes.reduce((acc, fix) => fix(acc), sql);
  }

  private assertReadOnly(sqlQuery: string): void {
    const trimmed = sqlQuery.trim().toUpperCase();
    if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
      throw new Error("Only SELECT queries are allowed.");
    }
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(sqlQuery)) {
        throw new Error(
          "Query contains forbidden operation (e.g. DROP, TRUNCATE, DELETE). Only read-only SELECT is allowed.",
        );
      }
    }
  }

  async naturalLanguageToSql(
    naturalLanguage: string,
    previousExecutionError?: string,
  ): Promise<{ sql: string }> {
    const trimmed = naturalLanguage?.trim();
    if (!trimmed) {
      throw new Error(
        "Natural language query is required and cannot be empty.",
      );
    }
    if (trimmed.length > MAX_NL_QUERY_LENGTH) {
      throw new Error(
        `Natural language query must be at most ${MAX_NL_QUERY_LENGTH} characters.`,
      );
    }
    if (!this.openai) {
      throw new Error(
        "OPENAI_API_KEY or OPENAI_BASE_URL is not set. Set them in .env.",
      );
    }
    let userContent = `Translate this natural language question into a single PostgreSQL SELECT query.\n\nQuestion: ${trimmed}`;
    if (previousExecutionError) {
      userContent += `\n\nThis error occurred when executing the previous generated query. Generate a corrected SQL query.\nError: ${previousExecutionError}`;
    }
    try {
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SCHEMA_CONTEXT },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
      });
      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("LLM did not return a SQL query.");
      }
      let sqlQuery = content
        .replace(/^```\w*\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();
      const selectIndex = sqlQuery.search(/\bSELECT\b/i);
      const withIndex = sqlQuery.search(/\bWITH\b/i);
      const startIndex =
        selectIndex >= 0 && (withIndex < 0 || selectIndex < withIndex)
          ? selectIndex
          : withIndex >= 0
            ? withIndex
            : -1;
      if (startIndex > 0) {
        sqlQuery = sqlQuery
          .slice(startIndex)
          .replace(/\n?```.*$/s, "")
          .trim();
      }
      sqlQuery = this.applySqlFixes(sqlQuery);
      this.assertReadOnly(sqlQuery);
      return { sql: sqlQuery };
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "status" in err &&
        (err as { status: number }).status === 429
          ? "OpenAI quota exceeded (check billing at platform.openai.com)."
          : err instanceof Error
            ? err.message
            : "OpenAI request failed.";
      throw new Error(msg);
    }
  }

  async executeSql(
    querySql: string,
  ): Promise<{ rows: unknown[]; columns: string[] }> {
    const trimmed = querySql?.trim();
    if (!trimmed) {
      throw new Error("SQL query is required and cannot be empty.");
    }
    if (trimmed.length > MAX_SQL_LENGTH) {
      throw new Error(
        `SQL query must be at most ${MAX_SQL_LENGTH} characters.`,
      );
    }
    this.assertReadOnly(trimmed);
    try {
      const result = await db.execute(sql.raw(trimmed));
      const rows = (result.rows ?? []) as Record<string, unknown>[];
      const columns =
        result.fields?.map((f: { name: string }) => f.name) ??
        (rows[0] ? Object.keys(rows[0]) : []);
      return { rows, columns };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/syntax error|at or near|aggregate functions/i.test(msg)) {
        throw new Error(`${msg}\n\nQuery:\n${trimmed}`);
      }
      throw err;
    }
  }

  /** True if the error looks like invalid SQL (GROUP BY, syntax, missing table, etc.). */
  private isSqlExecutionError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /GROUP BY|must appear in the|aggregate function|syntax error|at or near|column.*does not exist|missing FROM-clause entry|undefined table|relation .* does not exist/i.test(
      msg,
    );
  }

   // Extracts column/table identifiers from PostgreSQL error messages
   // (e.g. "column \"v.diagnosis\" must appear..." -> ["v.diagnosis"]).
  private extractColumnKeywordsFromSqlError(errorMessage: string): string[] {
    const keywords: string[] = [];
    const quoted = errorMessage.matchAll(/"([^"]+)"/g);
    for (const m of quoted) {
      const name = m[1].trim();
      if (
        name &&
        !/^(SELECT|FROM|WHERE|GROUP|ORDER|HAVING|LIMIT|AS|AND|OR)$/i.test(name)
      ) {
        keywords.push(name);
      }
    }
    const columnMatch = errorMessage.match(
      /column\s+(\w+(?:\.\w+)?)\s+(?:must|does)/i,
    );
    if (columnMatch) keywords.push(columnMatch[1]);
    const tableMatch = errorMessage.match(/table\s+["']?(\w+)["']?/i);
    if (tableMatch) keywords.push(tableMatch[1]);
    return [...new Set(keywords)];
  }

  async queryFromNaturalLanguage(naturalLanguage: string): Promise<{
    sql: string;
    rows: unknown[];
    columns: string[];
  }> {
    const trimmed = naturalLanguage?.trim();
    if (!trimmed) {
      throw new Error(
        "Natural language query is required and cannot be empty.",
      );
    }
    if (trimmed.length > MAX_NL_QUERY_LENGTH) {
      throw new Error(
        `Natural language query must be at most ${MAX_NL_QUERY_LENGTH} characters.`,
      );
    }
    let lastError: unknown;
    let previousErrorForLlm: string | undefined;
    for (let attempt = 1; attempt <= MAX_LLM_RETRIES; attempt++) {
      try {
        const { sql: generatedSql } = await this.naturalLanguageToSql(
          trimmed,
          previousErrorForLlm,
        );
        const { rows, columns } = await this.executeSql(generatedSql);
        return { sql: generatedSql, rows, columns };
      } catch (err: unknown) {
        lastError = err;
        if (!this.isSqlExecutionError(err) || attempt === MAX_LLM_RETRIES) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : String(err);
        const columnKeywords = this.extractColumnKeywordsFromSqlError(msg);
        previousErrorForLlm = columnKeywords.length
          ? `Error: ${msg}\n\nColumn names / keywords to fix (add to GROUP BY or use in an aggregate): ${columnKeywords.join(", ")}`
          : msg;
        this.logger.warn(
          `Error LLM (execution): ${msg}. Retry ${attempt}/${MAX_LLM_RETRIES} (max ${MAX_LLM_RETRIES})`,
        );
      }
    }
    throw lastError;
  }
}
