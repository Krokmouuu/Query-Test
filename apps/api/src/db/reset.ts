import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
import { db } from './index';
import {
  savedReports,
  visits,
  insurances,
  patients,
  doctors,
  facilities,
  organizations,
} from './schema';

async function reset() {
  await db.delete(savedReports);
  await db.delete(visits);
  await db.delete(insurances);
  await db.delete(patients);
  await db.delete(doctors);
  await db.delete(facilities);
  await db.delete(organizations);

  const { sql } = await import('drizzle-orm');
  const tables = ['organizations', 'facilities', 'doctors', 'patients', 'insurances', 'visits', 'saved_reports'];
  for (const table of tables) {
    await db.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), 1)`));
  }

  console.log('Database reset done.');
}

reset()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
