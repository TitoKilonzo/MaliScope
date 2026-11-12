import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { getDatabase, users, courses, lessons, learningProgress, briefings, documents, instruments, priceBars, watchlistItems, virtualPortfolios, virtualTransactions, ingestionRuns } from './db/index.js';
import { demoBriefings, demoCourses, demoDocuments, demoInstruments } from './data/demo.js';
import { getLessonBody } from './data/lesson-content.js';
import { createSession, hashPassword, sessionCookieName, verifyPassword } from './services/auth.js';
import { optionalAuth, requireAdmin, requireAuth } from './middleware/auth.js';

const app = express();
const allowedOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({ origin: allowedOrigin, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use((req, res, next) => { const origin = req.get('origin'); if (origin && origin !== allowedOrigin) return res.status(403).json({ error: 'Origin is not allowed.' }); next(); });
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(optionalAuth);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Please try again later.' } });
const memory = {
  users: new Map<string, { id: string; name: string; email: string; passwordHash: string; role: string }>(),
  watchlists: new Map<string, Set<string>>(),
  portfolios: new Map<string, { cash: number; startingCash: number; holdings: Map<string, number>; transactions: Array<{ id: string; symbol: string; side: string; quantity: number; price: number; createdAt: string }> }>(),
  completedLessons: new Map<string, Set<string>>(),
  publishedBriefings: [...demoBriefings] as any[],
  draftBriefings: [] as any[],
};

export async function initialiseDemoAdmin() {
  if (getDatabase() || memory.users.size) return;
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@maliscope.demo').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  memory.users.set('demo-admin', { id: 'demo-admin', name: process.env.SEED_ADMIN_NAME || 'MaliScope Administrator', email, passwordHash: await hashPassword(password), role: 'admin' });
}

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
}
function apiError(res: express.Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  if (process.env.NODE_ENV !== 'production') console.error(error);
  return res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : message });
}

app.get('/api/health', async (_req, res) => {
  const db = getDatabase();
  const dbMode = Boolean(db);
  const availableBars = db ? await db.select({ id: priceBars.id }).from(priceBars).where(eq(priceBars.externalDisplayAllowed, true)).limit(1) : [];
  const marketData = !dbMode ? 'illustrative-demo' : availableBars.length ? 'provider-data' : 'no-verified-data';
  res.json({ status: 'ok', service: 'MaliScope API', mode: dbMode ? 'postgresql' : 'demo-memory', marketData, timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(255), password: z.string().min(10).max(128) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please provide a valid name, email and password of at least 10 characters.', details: parsed.error.flatten() });
  const db = getDatabase();
  try {
    const email = parsed.data.email.toLowerCase();
    const existing = db ? await db.select().from(users).where(eq(users.email, email)).limit(1) : [...memory.users.values()].filter((u) => u.email === email);
    if (existing.length) return res.status(409).json({ error: 'An account with this email already exists.' });
    const passwordHash = await hashPassword(parsed.data.password);
    const user = db
      ? (await db.insert(users).values({ name: parsed.data.name, email, passwordHash, role: 'learner' }).returning())[0]
      : { id: cryptoRandomId(), name: parsed.data.name, email, passwordHash, role: 'learner' };
    if (!db) memory.users.set(user.id, user);
    res.cookie(sessionCookieName, createSession({ id: user.id, name: user.name, email: user.email, role: user.role }), cookieOptions());
    return res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) { return apiError(res, error); }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
  try {
    const email = parsed.data.email.toLowerCase();
    const db = getDatabase();
    const rows = db ? await db.select().from(users).where(eq(users.email, email)).limit(1) : [...memory.users.values()].filter((u) => u.email === email);
    const user = rows[0];
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    res.cookie(sessionCookieName, createSession({ id: user.id, name: user.name, email: user.email, role: user.role }), cookieOptions());
    return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) { return apiError(res, error); }
});

app.post('/api/auth/logout', (_req, res) => { res.clearCookie(sessionCookieName, { ...cookieOptions(), maxAge: undefined }); res.json({ success: true }); });
app.get('/api/auth/me', (req, res) => res.json({ user: req.user ?? null }));

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    if (db) {
      const [progressRows, watchRows, accounts, published, courseRows, lessonRows] = await Promise.all([
        db.select().from(learningProgress).where(eq(learningProgress.userId, req.user!.id)),
        db.select().from(watchlistItems).where(eq(watchlistItems.userId, req.user!.id)),
        db.select().from(virtualPortfolios).where(eq(virtualPortfolios.userId, req.user!.id)).limit(1),
        db.select().from(briefings).where(eq(briefings.status, 'published')).orderBy(desc(briefings.publishedAt)).limit(1),
        db.select().from(courses).where(eq(courses.published, true)),
        db.select().from(lessons)
      ]);
      const completedIds = new Set(progressRows.map((row) => row.lessonId));
      const courseProgress = courseRows.map((course) => {
        const courseLessons = lessonRows.filter((lesson) => lesson.courseId === course.id);
        const completedCount = courseLessons.filter((lesson) => completedIds.has(lesson.id)).length;
        return { ...course, lessonsCount: courseLessons.length, progress: courseLessons.length ? Math.round((completedCount / courseLessons.length) * 100) : 0 };
      });
      return res.json({ user: req.user, stats: { learningStreak: 0, lessonsCompleted: progressRows.length, watchlistCount: watchRows.length, virtualCash: accounts.length ? Number(accounts[0].cashBalance) : 100000 }, courses: courseProgress.length ? courseProgress : demoCourses, briefing: published[0] || demoBriefings[0], market: await marketOverview() });
    }
    const completedSet = memory.completedLessons.get(req.user!.id) ?? new Set<string>();
    const portfolio = getPortfolio(req.user!.id);
    const courseProgress = demoCourses.map((course) => {
      const total = course.modules.length;
      const completedCount = course.modules.filter((_, index) => completedSet.has(`${course.id}-lesson-${index + 1}`)).length;
      return { ...course, lessonsCount: total, progress: total ? Math.round((completedCount / total) * 100) : 0 };
    });
    return res.json({ user: req.user, stats: { learningStreak: 0, lessonsCompleted: completedSet.size, watchlistCount: memory.watchlists.get(req.user!.id)?.size ?? 0, virtualCash: portfolio.cash }, courses: courseProgress, briefing: memory.publishedBriefings[0], market: await marketOverview() });
  } catch (error) { return apiError(res, error); }
});

app.get('/api/academy/courses', async (_req, res) => {
  try {
    const db = getDatabase();
    const rows = db ? await db.select().from(courses).where(eq(courses.published, true)).orderBy(desc(courses.createdAt)) : demoCourses;
    res.json({ courses: rows.length ? rows : demoCourses });
  } catch (error) { return apiError(res, error); }
});
app.get('/api/academy/courses/:slug', async (req, res) => {
  try {
    const db = getDatabase();
    const rows = db ? await db.select().from(courses).where(and(eq(courses.slug, req.params.slug), eq(courses.published, true))).limit(1) : demoCourses.filter((c) => c.slug === req.params.slug);
    const course = rows[0];
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    if (db) {
      const lessonRows = await db.select().from(lessons).where(eq(lessons.courseId, course.id)).orderBy(lessons.orderIndex);
      const completedRows = req.user ? await db.select().from(learningProgress).where(eq(learningProgress.userId, req.user.id)) : [];
      const completedIds = new Set(completedRows.map((row) => row.lessonId));
      return res.json({ course, lessons: lessonRows.map((lesson) => ({ id: lesson.id, title: lesson.title, body: lesson.body, minutes: lesson.minutes, completed: completedIds.has(lesson.id) })) });
    }
    return res.json({ course, lessons: ('modules' in course ? course.modules : []).map((title: string, i: number) => ({ id: `${course.id}-lesson-${i + 1}`, title, body: getLessonBody(title), minutes: 7 + (i % 4), completed: Boolean(req.user && memory.completedLessons.get(req.user.id)?.has(`${course.id}-lesson-${i + 1}`)) })) });
  } catch (error) { return apiError(res, error); }
});
app.post('/api/academy/lessons/:lessonId/complete', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    if (db) {
      const [lesson] = await db.select().from(lessons).where(eq(lessons.id, req.params.lessonId)).limit(1);
      if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
      await db.insert(learningProgress).values({ userId: req.user!.id, lessonId: lesson.id }).onConflictDoNothing();
      const rows = await db.select().from(learningProgress).where(eq(learningProgress.userId, req.user!.id));
      return res.json({ success: true, completedCount: rows.length });
    }
    const set = memory.completedLessons.get(req.user!.id) ?? new Set<string>(); set.add(req.params.lessonId); memory.completedLessons.set(req.user!.id, set); return res.json({ success: true, completedCount: set.size });
  } catch (error) { return apiError(res, error); }
});

async function loadMarketInstruments() {
  const db = getDatabase();
  if (!db) return demoInstruments.map((item) => ({ ...item, dataStatus: 'illustrative-demo', source: 'MaliScope demo dataset', asOf: null as string | null }));
  const catalogue = await db.select().from(instruments).where(eq(instruments.isActive, true));
  const bars = await db.select().from(priceBars).where(eq(priceBars.externalDisplayAllowed, true)).orderBy(desc(priceBars.marketDate)).limit(20_000);
  const latestByInstrument = new Map<string, typeof bars>();
  for (const bar of bars) {
    const rows = latestByInstrument.get(bar.instrumentId) ?? [];
    if (rows.length < 2) rows.push(bar);
    latestByInstrument.set(bar.instrumentId, rows);
  }
  return catalogue.map((item) => {
    const history = latestByInstrument.get(item.id) ?? [];
    const latest = history[0]; const previous = history[1];
    const price = latest ? Number(latest.close) : null;
    const changePct = latest && previous && Number(previous.close) !== 0 ? ((Number(latest.close) / Number(previous.close)) - 1) * 100 : null;
    return { symbol: item.symbol, name: item.name, sector: item.sector, currency: item.currency, description: item.description, price, changePct, volume: latest ? Number(latest.volume) : null, marketCap: 'Not supplied', dataStatus: latest?.status ?? 'no-verified-quote', source: latest?.source ?? 'No authorised data feed', asOf: latest?.marketDate?.toISOString() ?? null, retrievedAt: latest?.retrievedAt?.toISOString() ?? null };
  });
}
async function marketOverview() {
  const db = getDatabase();
  if (!db) {
    const gainers = [...demoInstruments].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
    const losers = [...demoInstruments].sort((a, b) => a.changePct - b.changePct).slice(0, 3);
    return { index: 'NSE All Share Index', indexValue: 'Illustrative', changePct: 0.72, marketStatus: 'Illustrative demo snapshot', turnover: 'Illustrative only', volume: 'Illustrative only', advances: 5, declines: 3, gainers, losers, asOf: null, source: 'MaliScope demo dataset', dataStatus: 'illustrative-demo' };
  }
  const listed = await loadMarketInstruments();
  const quoted = listed.filter((item) => item.price !== null);
  const gainers = quoted.filter((item) => (item.changePct ?? 0) > 0).sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)).slice(0, 3);
  const losers = quoted.filter((item) => (item.changePct ?? 0) < 0).sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0)).slice(0, 3);
  const latestDates = quoted.map((item) => item.asOf).filter((value): value is string => Boolean(value)).sort().reverse();
  return { index: 'NSE market data', indexValue: 'Official index feed not connected', changePct: null, marketStatus: quoted.length ? 'Daily security data available' : 'Awaiting authorised provider data', turnover: 'Not supplied', volume: quoted.reduce((sum, item) => sum + (item.volume ?? 0), 0).toLocaleString('en-KE'), advances: quoted.filter((item) => (item.changePct ?? 0) > 0).length, declines: quoted.filter((item) => (item.changePct ?? 0) < 0).length, gainers, losers, asOf: latestDates[0] ?? null, source: quoted[0]?.source ?? 'No authorised data feed', dataStatus: quoted.length ? 'provider-data' : 'no-verified-data' };
}
app.get('/api/markets/overview', async (_req, res) => { try { res.json(await marketOverview()); } catch (error) { return apiError(res, error); } });
app.get('/api/markets/instruments', async (req, res) => {
  try {
    const q = String(req.query.q || '').toLowerCase(); const sector = String(req.query.sector || 'all');
    const available = await loadMarketInstruments();
    const filtered = available.filter((item) => (!q || `${item.symbol} ${item.name} ${item.sector}`.toLowerCase().includes(q)) && (sector === 'all' || item.sector.toLowerCase() === sector.toLowerCase()));
    return res.json({ instruments: filtered, count: filtered.length, dataStatus: getDatabase() ? (filtered.some((item) => item.price !== null) ? 'provider-data' : 'no-verified-data') : 'illustrative-demo', source: filtered.find((item) => item.price !== null)?.source ?? (getDatabase() ? 'No authorised data feed' : 'MaliScope demo dataset') });
  } catch (error) { return apiError(res, error); }
});
app.get('/api/markets/instruments/:symbol', async (req, res) => {
  try {
    const db = getDatabase();
    if (db) {
      const [catalogueItem] = await db.select().from(instruments).where(eq(instruments.symbol, req.params.symbol.toUpperCase())).limit(1);
      if (!catalogueItem) return res.status(404).json({ error: 'Company not found.' });
      const bars = await db.select().from(priceBars).where(and(eq(priceBars.instrumentId, catalogueItem.id), eq(priceBars.externalDisplayAllowed, true))).orderBy(desc(priceBars.marketDate)).limit(60);
      const history = bars.slice().reverse().map((bar) => ({ date: bar.marketDate.toISOString().slice(0, 10), close: Number(bar.close) }));
      const latest = bars[0]; const previous = bars[1];
      return res.json({ instrument: { symbol: catalogueItem.symbol, name: catalogueItem.name, sector: catalogueItem.sector, currency: catalogueItem.currency, description: catalogueItem.description, price: latest ? Number(latest.close) : null, changePct: latest && previous ? (Number(latest.close) / Number(previous.close) - 1) * 100 : null, volume: latest ? Number(latest.volume) : null, marketCap: 'Not supplied' }, history, dataStatus: latest?.status ?? 'no-verified-quote', source: latest?.source ?? 'No authorised data feed', asOf: latest?.marketDate?.toISOString() ?? null, retrievedAt: latest?.retrievedAt?.toISOString() ?? null });
    }
    const item = demoInstruments.find((entry) => entry.symbol.toLowerCase() === req.params.symbol.toLowerCase());
    if (!item) return res.status(404).json({ error: 'Company not found.' });
    const history = Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10), close: Number((item.price * (0.93 + Math.sin(i / 4) * 0.025 + i * 0.002 + (i % 3) * 0.001)).toFixed(2)) }));
    return res.json({ instrument: item, history, dataStatus: 'illustrative-demo', source: 'MaliScope demo dataset', asOf: null, retrievedAt: null });
  } catch (error) { return apiError(res, error); }
});

app.get('/api/briefings', async (req, res) => {
  try {
    const db = getDatabase();
    const rows = db ? await db.select().from(briefings).where(eq(briefings.status, 'published')).orderBy(desc(briefings.publishedAt)) : memory.publishedBriefings;
    res.json({ briefings: rows });
  } catch (error) { return apiError(res, error); }
});
app.get('/api/library/documents', async (_req, res) => {
  try {
    const db = getDatabase();
    const rows = db ? await db.select().from(documents).where(eq(documents.published, true)).orderBy(desc(documents.createdAt)) : demoDocuments;
    res.json({ documents: rows.length ? rows : demoDocuments });
  } catch (error) { return apiError(res, error); }
});

app.get('/api/watchlist', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    if (db) {
      const rows = await db.select({ symbol: instruments.symbol }).from(watchlistItems).innerJoin(instruments, eq(watchlistItems.instrumentId, instruments.id)).where(eq(watchlistItems.userId, req.user!.id));
      const available = await loadMarketInstruments();
      const items = rows.map((row) => available.find((i) => i.symbol === row.symbol)).filter(Boolean);
      return res.json({ items });
    }
    const symbols = [...(memory.watchlists.get(req.user!.id) ?? new Set<string>())];
    return res.json({ items: symbols.map((symbol) => demoInstruments.find((i) => i.symbol === symbol)).filter(Boolean) });
  } catch (error) { return apiError(res, error); }
});
app.post('/api/watchlist', requireAuth, async (req, res) => {
  const parsed = z.object({ symbol: z.string().trim().min(1).max(24).transform((s) => s.toUpperCase()) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'A valid instrument symbol is required.' });
  if (!demoInstruments.some((i) => i.symbol === parsed.data.symbol)) return res.status(404).json({ error: 'Instrument not found.' });
  try {
    const db = getDatabase();
    if (db) {
      const [instrument] = await db.select().from(instruments).where(eq(instruments.symbol, parsed.data.symbol)).limit(1);
      if (!instrument) return res.status(404).json({ error: 'Instrument not found in the connected market catalogue.' });
      await db.insert(watchlistItems).values({ userId: req.user!.id, instrumentId: instrument.id }).onConflictDoNothing();
      return res.status(201).json({ success: true });
    }
    const items = memory.watchlists.get(req.user!.id) ?? new Set<string>(); items.add(parsed.data.symbol); memory.watchlists.set(req.user!.id, items);
    return res.status(201).json({ success: true, items: [...items] });
  } catch (error) { return apiError(res, error); }
});
app.delete('/api/watchlist/:symbol', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    if (db) {
      const [instrument] = await db.select().from(instruments).where(eq(instruments.symbol, req.params.symbol.toUpperCase())).limit(1);
      if (instrument) await db.delete(watchlistItems).where(and(eq(watchlistItems.userId, req.user!.id), eq(watchlistItems.instrumentId, instrument.id)));
    } else memory.watchlists.get(req.user!.id)?.delete(req.params.symbol.toUpperCase());
    return res.json({ success: true });
  } catch (error) { return apiError(res, error); }
});

function getPortfolio(userId: string) {
  let portfolio = memory.portfolios.get(userId);
  if (!portfolio) { portfolio = { cash: 100000, startingCash: 100000, holdings: new Map(), transactions: [] }; memory.portfolios.set(userId, portfolio); }
  return portfolio;
}
app.get('/api/practice/instruments', requireAuth, (_req, res) => {
  const items = demoInstruments.map((item) => ({ ...item, dataStatus: 'illustrative-simulation', source: 'MaliScope virtual portfolio reference prices' }));
  return res.json({ instruments: items, dataStatus: 'illustrative-simulation', disclaimer: 'These fixed reference prices exist only for the practice simulator. They are not NSE quotations and must not be used as market information.' });
});

app.get('/api/practice/portfolio', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    if (db) {
      await db.insert(virtualPortfolios).values({ userId: req.user!.id }).onConflictDoNothing();
      const [account] = await db.select().from(virtualPortfolios).where(eq(virtualPortfolios.userId, req.user!.id)).limit(1);
      if (!account) throw new Error('Could not initialise the simulated portfolio.');
      const transactions = await db.select({ symbol: instruments.symbol, side: virtualTransactions.side, quantity: virtualTransactions.quantity, price: virtualTransactions.price, createdAt: virtualTransactions.createdAt, id: virtualTransactions.id }).from(virtualTransactions).innerJoin(instruments, eq(virtualTransactions.instrumentId, instruments.id)).where(eq(virtualTransactions.portfolioId, account.id)).orderBy(desc(virtualTransactions.createdAt));
      const holdingsMap = new Map<string, number>();
      for (const tx of transactions) holdingsMap.set(tx.symbol, (holdingsMap.get(tx.symbol) ?? 0) + (tx.side === 'buy' ? tx.quantity : -tx.quantity));
      const holdings = [...holdingsMap.entries()].filter(([, quantity]) => quantity > 0).map(([symbol, quantity]) => { const instrument = demoInstruments.find((i) => i.symbol === symbol)!; return { ...instrument, quantity, marketValue: quantity * instrument.price }; });
      const invested = holdings.reduce((sum, item) => sum + item.marketValue, 0); const cash = Number(account.cashBalance);
      return res.json({ portfolio: { cash, startingCash: Number(account.startingCash), invested, totalValue: cash + invested, gainLoss: cash + invested - Number(account.startingCash), holdings, transactions: transactions.map((t) => ({ ...t, price: Number(t.price), createdAt: t.createdAt.toISOString() })) }, disclaimer: 'Simulation only. No real orders, brokerage connection or actual investment takes place.' });
    }
    const portfolio = getPortfolio(req.user!.id);
    const holdings = [...portfolio.holdings.entries()].filter(([, quantity]) => quantity > 0).map(([symbol, quantity]) => { const instrument = demoInstruments.find((i) => i.symbol === symbol)!; return { ...instrument, quantity, marketValue: quantity * instrument.price }; });
    const invested = holdings.reduce((sum, item) => sum + item.marketValue, 0);
    return res.json({ portfolio: { cash: portfolio.cash, startingCash: portfolio.startingCash, invested, totalValue: portfolio.cash + invested, gainLoss: portfolio.cash + invested - portfolio.startingCash, holdings, transactions: portfolio.transactions.slice().reverse() }, disclaimer: 'Simulation only. No real orders, brokerage connection or actual investment takes place.' });
  } catch (error) { return apiError(res, error); }
});
app.post('/api/practice/trades', requireAuth, async (req, res) => {
  const parsed = z.object({ symbol: z.string().min(1).max(24).transform((s) => s.toUpperCase()), side: z.enum(['buy', 'sell']), quantity: z.number().int().positive().max(100000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide a valid symbol, buy/sell side and positive whole-number quantity.' });
  const instrument = demoInstruments.find((i) => i.symbol === parsed.data.symbol);
  if (!instrument) return res.status(404).json({ error: 'Company not found.' });
  try {
    const db = getDatabase(); const cost = instrument.price * parsed.data.quantity;
    if (db) {
      const [catalogueItem] = await db.select().from(instruments).where(eq(instruments.symbol, instrument.symbol)).limit(1);
      if (!catalogueItem) return res.status(404).json({ error: 'Instrument not found in the connected market catalogue.' });
      const result = await db.transaction(async (tx) => {
        await tx.insert(virtualPortfolios).values({ userId: req.user!.id }).onConflictDoNothing();
        const [account] = await tx.select().from(virtualPortfolios).where(eq(virtualPortfolios.userId, req.user!.id)).for('update').limit(1);
        if (!account) throw new Error('Could not initialise the simulated portfolio.');
        const history = await tx.select().from(virtualTransactions).where(eq(virtualTransactions.portfolioId, account.id));
        const current = history.filter((t) => t.instrumentId === catalogueItem.id).reduce((sum, t) => sum + (t.side === 'buy' ? t.quantity : -t.quantity), 0);
        const cash = Number(account.cashBalance);
        if (parsed.data.side === 'buy' && cost > cash) throw new Error('Not enough virtual cash for this simulated purchase.');
        if (parsed.data.side === 'sell' && parsed.data.quantity > current) throw new Error('You do not hold enough units in this simulated portfolio.');
        const nextCash = parsed.data.side === 'buy' ? cash - cost : cash + cost;
        await tx.update(virtualPortfolios).set({ cashBalance: nextCash.toFixed(2) }).where(eq(virtualPortfolios.id, account.id));
        const [trade] = await tx.insert(virtualTransactions).values({ portfolioId: account.id, instrumentId: catalogueItem.id, side: parsed.data.side, quantity: parsed.data.quantity, price: instrument.price.toFixed(4) }).returning();
        return { transaction: { id: trade.id, symbol: instrument.symbol, side: trade.side, quantity: trade.quantity, price: Number(trade.price), createdAt: trade.createdAt.toISOString() }, cash: nextCash };
      });
      return res.status(201).json({ success: true, ...result });
    }
    const portfolio = getPortfolio(req.user!.id); const current = portfolio.holdings.get(instrument.symbol) ?? 0;
    if (parsed.data.side === 'buy' && cost > portfolio.cash) return res.status(400).json({ error: 'Not enough virtual cash for this simulated purchase.' });
    if (parsed.data.side === 'sell' && parsed.data.quantity > current) return res.status(400).json({ error: 'You do not hold enough units in this simulated portfolio.' });
    if (parsed.data.side === 'buy') { portfolio.cash -= cost; portfolio.holdings.set(instrument.symbol, current + parsed.data.quantity); } else { portfolio.cash += cost; portfolio.holdings.set(instrument.symbol, current - parsed.data.quantity); }
    const transaction = { id: cryptoRandomId(), symbol: instrument.symbol, side: parsed.data.side, quantity: parsed.data.quantity, price: instrument.price, createdAt: new Date().toISOString() };
    portfolio.transactions.push(transaction); return res.status(201).json({ success: true, transaction, cash: portfolio.cash });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to record simulated transaction.';
    if (message.includes('virtual cash') || message.includes('hold enough')) return res.status(400).json({ error: message });
    return apiError(res, error);
  }
});

app.get('/api/admin/briefings', requireAdmin, async (_req, res) => {
  try {
    const db = getDatabase();
    const rows = db
      ? await db.select().from(briefings).where(eq(briefings.status, 'draft')).orderBy(desc(briefings.createdAt)).limit(30)
      : memory.draftBriefings;
    return res.json({ briefings: rows });
  } catch (error) { return apiError(res, error); }
});
app.post('/api/admin/briefings/:slug/publish', requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    if (db) {
      const [draft] = await db.select().from(briefings).where(and(eq(briefings.slug, req.params.slug), eq(briefings.status, 'draft'))).limit(1);
      if (!draft) return res.status(404).json({ error: 'Draft briefing not found.' });
      const [published] = await db.update(briefings).set({ status: 'published', publishedAt: new Date() }).where(eq(briefings.id, draft.id)).returning();
      return res.json({ briefing: published });
    }
    const index = memory.draftBriefings.findIndex((item) => item.slug === req.params.slug);
    if (index < 0) return res.status(404).json({ error: 'Draft briefing not found.' });
    const [draft] = memory.draftBriefings.splice(index, 1);
    const published = { ...draft, status: 'published', publishedAt: new Date().toISOString() };
    memory.publishedBriefings.unshift(published);
    return res.json({ briefing: published });
  } catch (error) { return apiError(res, error); }
});

app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  try {
    const db = getDatabase();
    if (db) {
      const [userRows, courseRows, briefingRows, documentRows, latestRun] = await Promise.all([
        db.select().from(users), db.select().from(courses), db.select().from(briefings).where(eq(briefings.status, 'published')),
        db.select().from(documents).where(eq(documents.published, true)), db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.startedAt)).limit(1)
      ]);
      const run = latestRun[0];
      return res.json({ users: userRows.length, courses: courseRows.length, briefings: briefingRows.length, documents: documentRows.length, ingestion: { status: run?.status ?? 'awaiting-provider', provider: run?.provider ?? 'No market data run recorded', lastRun: run?.startedAt?.toISOString() ?? null } });
    }
    return res.json({ users: memory.users.size, courses: demoCourses.length, briefings: memory.publishedBriefings.length, documents: demoDocuments.length, ingestion: { status: 'demo', provider: 'MaliScope demo dataset', lastRun: null } });
  } catch (error) { return apiError(res, error); }
});
app.post('/api/admin/briefings', requireAdmin, async (req, res) => {
  const parsed = z.object({ title: z.string().min(5).max(220), summary: z.string().min(10).max(500), body: z.string().min(20).max(12000), category: z.string().min(2).max(80), sourceName: z.string().min(2).max(180), sourceUrl: z.string().url().optional().or(z.literal('')), publish: z.boolean().default(false) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please check the briefing fields.', details: parsed.error.flatten() });
  try {
    const publishedAt = parsed.data.publish ? new Date() : null;
    const slug = `${slugify(parsed.data.title)}-${Date.now()}`;
    const db = getDatabase();
    if (db) {
      const [item] = await db.insert(briefings).values({ slug, title: parsed.data.title, summary: parsed.data.summary, body: parsed.data.body, category: parsed.data.category, sourceName: parsed.data.sourceName, sourceUrl: parsed.data.sourceUrl || null, status: parsed.data.publish ? 'published' : 'draft', publishedAt, marketDate: new Date() }).returning();
      return res.status(201).json({ briefing: item });
    }
    const item = { id: cryptoRandomId(), slug, title: parsed.data.title, summary: parsed.data.summary, body: parsed.data.body, category: parsed.data.category, sourceName: parsed.data.sourceName, sourceUrl: parsed.data.sourceUrl || null, status: parsed.data.publish ? 'published' : 'draft', publishedAt: publishedAt?.toISOString() ?? null, marketDate: new Date().toISOString(), tag: 'Editorial', readTime: '4 min' };
    if (parsed.data.publish) memory.publishedBriefings.unshift(item); else memory.draftBriefings.push(item);
    return res.status(201).json({ briefing: item });
  } catch (error) { return apiError(res, error); }
});

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => apiError(res, err));

function cryptoRandomId() { return globalThis.crypto.randomUUID(); }
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120); }

export default app;
