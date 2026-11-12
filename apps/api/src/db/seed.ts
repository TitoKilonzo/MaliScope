import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { connectDatabase, closeDatabase, exchanges, instruments, courses, lessons, documents, briefings, users } from './index.js';
import { demoBriefings, demoCourses, demoDocuments, demoInstruments } from '../data/demo.js';
import { getLessonBody } from '../data/lesson-content.js';
import { hashPassword } from '../services/auth.js';
import { eq } from 'drizzle-orm';

if (process.env.NODE_ENV === 'production') {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || '';
  if (!adminEmail || !adminPassword || adminEmail.endsWith('@maliscope.demo') || adminPassword === 'ChangeMe123!' || adminPassword.length < 14) {
    throw new Error('Production seeding requires a non-demo admin email and a unique password of at least 14 characters.');
  }
}
const db = await connectDatabase();
if (!db) throw new Error('DATABASE_URL is required to seed PostgreSQL.');
try {
  const [exchange] = await db.insert(exchanges).values({ code: 'NSE', name: 'Nairobi Securities Exchange', country: 'Kenya', currency: 'KES' }).onConflictDoUpdate({ target: exchanges.code, set: { name: 'Nairobi Securities Exchange' } }).returning();
  for (const item of demoInstruments) {
    await db.insert(instruments).values({ exchangeId: exchange.id, symbol: item.symbol, name: item.name, sector: item.sector, description: item.description, currency: item.currency }).onConflictDoUpdate({ target: instruments.symbol, set: { name: item.name, sector: item.sector, description: item.description } });
  }
  for (const item of demoCourses) {
    const [course] = await db.insert(courses).values({ slug: item.slug, title: item.title, description: item.description, category: item.category, level: item.level, duration: item.duration, lessonsCount: item.lessonsCount, published: true }).onConflictDoUpdate({ target: courses.slug, set: { title: item.title, description: item.description, published: true } }).returning();
    for (const [index, title] of item.modules.entries()) {
      const found = await db.select().from(lessons).where(eq(lessons.courseId, course.id));
      if (!found.some((lesson) => lesson.title === title)) await db.insert(lessons).values({ courseId: course.id, slug: `lesson-${index + 1}`, title, body: getLessonBody(title), orderIndex: index + 1, minutes: 7 + (index % 4) });
    }
  }
  for (const item of demoDocuments) {
    const existing = await db.select().from(documents).where(eq(documents.title, item.title)).limit(1);
    if (!existing.length) await db.insert(documents).values({ title: item.title, description: item.description, category: item.category, fileUrl: item.fileUrl, fileType: 'application/pdf', fileSize: item.fileSize, version: item.version, published: true });
  }
  for (const item of demoBriefings) {
    await db.insert(briefings).values({ slug: item.slug, title: item.title, summary: item.summary, body: item.body, category: item.category, sourceName: item.sourceName, marketDate: new Date(), status: 'published', publishedAt: new Date() }).onConflictDoUpdate({ target: briefings.slug, set: { title: item.title, summary: item.summary, body: item.body, status: 'published', publishedAt: new Date() } });
  }
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@maliscope.demo').toLowerCase();
  const existingAdmin = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!existingAdmin.length) await db.insert(users).values({ name: process.env.SEED_ADMIN_NAME || 'MaliScope Administrator', email, passwordHash: await hashPassword(process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'), role: 'admin' });
  console.log('MaliScope database seeded.');
} finally { await closeDatabase(); }
