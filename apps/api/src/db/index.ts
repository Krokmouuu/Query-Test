import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const rawUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/clinic';
const connectionString = /:[^/]*@/.test(rawUrl) ? rawUrl : rawUrl.replace('@', ':@');

const pool = new Pool({
  connectionString,
  max: 10,
});

export const db = drizzle(pool, { schema });
export * from './schema';
