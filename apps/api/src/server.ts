import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
const { default: app, initialiseDemoAdmin } = await import('./app.js');
const { connectDatabase, closeDatabase } = await import('./db/index.js');

const port = Number(process.env.PORT || 4000);
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET must be at least 32 characters in production.');
}
try {
  const connected = await connectDatabase();
  if (!connected && process.env.DEMO_MODE === 'false') throw new Error('DATABASE_URL is required when DEMO_MODE=false.');
  if (connected) console.log('Connected to PostgreSQL.');
} catch (error) {
  if (process.env.DEMO_MODE === 'false') throw error;
  console.warn('PostgreSQL unavailable; starting in in-memory demo mode.');
}
await initialiseDemoAdmin();
const server = app.listen(port, () => console.log(`MaliScope API listening on http://localhost:${port}`));

async function shutdown(signal: string) {
  console.log(`${signal} received. Closing API...`);
  server.close(async () => { await closeDatabase(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
