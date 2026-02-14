/**
 * DTOs for query endpoints with validation constraints.
 * Used by QueryController; validation is enforced in controller and QueryService.
 */

/** Max length for natural language query (chars). */
export const MAX_NL_QUERY_LENGTH = 2000;

/** Max length for raw SQL (chars). */
export const MAX_SQL_LENGTH = 50_000;

export class NaturalLanguageQueryDto {
  /** Natural language question to translate to SQL. */
  query!: string;
}

export class ExecuteSqlDto {
  /** Raw SQL SELECT query to execute (read-only). */
  sql!: string;
}
