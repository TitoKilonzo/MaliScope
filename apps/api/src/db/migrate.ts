import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');
const client = new pg.Client({ connectionString });
try {
  await client.connect();
  const migration = await readFile(resolve(process.cwd(), 'drizzle/0001_initial.sql'), 'utf8');
  await client.query(migration);
  console.log('Database migration applied.');
} finally { await client.end(); }
