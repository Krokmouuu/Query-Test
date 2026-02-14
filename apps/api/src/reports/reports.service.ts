import { Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { savedReports } from '../db/schema';

@Injectable()
export class ReportsService {
  async findAll() {
    return db.select().from(savedReports).orderBy(desc(savedReports.updatedAt));
  }

  async findOne(id: number) {
    const rows = await db.select().from(savedReports).where(eq(savedReports.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async create(data: {
    name: string;
    naturalLanguageQuery?: string;
    sql?: string;
    chartType?: string;
  }) {
    const [report] = await db
      .insert(savedReports)
      .values({
        name: data.name,
        naturalLanguageQuery: data.naturalLanguageQuery ?? null,
        sql: data.sql ?? null,
        chartType: data.chartType ?? null,
      })
      .returning();
    return report;
  }

  async update(
    id: number,
    data: { name?: string; naturalLanguageQuery?: string; sql?: string; chartType?: string },
  ) {
    const [report] = await db
      .update(savedReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(savedReports.id, id))
      .returning();
    return report ?? null;
  }

  async remove(id: number) {
    await db.delete(savedReports).where(eq(savedReports.id, id));
    return { ok: true };
  }
}
