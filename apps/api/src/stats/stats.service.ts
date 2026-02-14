import { Injectable } from '@nestjs/common';
import { count } from 'drizzle-orm';
import { db } from '../db';
import {
  organizations,
  facilities,
  doctors,
  patients,
  visits,
  insurances,
  savedReports,
} from '../db/schema';

export type DbStats = {
  organizations: number;
  facilities: number;
  doctors: number;
  patients: number;
  visits: number;
  insurances: number;
  savedReports: number;
};

@Injectable()
export class StatsService {
  async getStats(): Promise<DbStats> {
    const [org] = await db.select({ count: count() }).from(organizations);
    const [fac] = await db.select({ count: count() }).from(facilities);
    const [doc] = await db.select({ count: count() }).from(doctors);
    const [pat] = await db.select({ count: count() }).from(patients);
    const [vis] = await db.select({ count: count() }).from(visits);
    const [ins] = await db.select({ count: count() }).from(insurances);
    const [rep] = await db.select({ count: count() }).from(savedReports);
    return {
      organizations: Number(org?.count ?? 0),
      facilities: Number(fac?.count ?? 0),
      doctors: Number(doc?.count ?? 0),
      patients: Number(pat?.count ?? 0),
      visits: Number(vis?.count ?? 0),
      insurances: Number(ins?.count ?? 0),
      savedReports: Number(rep?.count ?? 0),
    };
  }
}
