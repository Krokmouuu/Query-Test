import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const rawUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/clinic';
const databaseUrl = /:[^\/]*@/.test(rawUrl) ? rawUrl : rawUrl.replace('@', ':@');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
