import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

const { Pool } = pg;
let pool: pg.Pool | null = null;
let database: NodePgDatabase<typeof schema> | null = null;

export async function connectDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  await pool.query('select 1');
  database = drizzle(pool, { schema });
  return database;
}
export function getDatabase() { return database; }
export async function closeDatabase() { if (pool) await pool.end(); pool = null; database = null; }
export * from './schema.js';
