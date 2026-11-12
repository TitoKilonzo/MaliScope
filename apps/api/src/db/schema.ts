import { pgTable, uuid, varchar, text, boolean, integer, numeric, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('learner'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const exchanges = pgTable('exchanges', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 12 }).notNull().unique(),
  name: varchar('name', { length: 160 }).notNull(),
  country: varchar('country', { length: 80 }).notNull(),
  currency: varchar('currency', { length: 8 }).notNull(),
});

export const instruments = pgTable('instruments', {
  id: uuid('id').defaultRandom().primaryKey(),
  exchangeId: uuid('exchange_id').references(() => exchanges.id),
  symbol: varchar('symbol', { length: 24 }).notNull().unique(),
  name: varchar('name', { length: 180 }).notNull(),
  sector: varchar('sector', { length: 100 }).notNull(),
  description: text('description').notNull(),
  currency: varchar('currency', { length: 8 }).notNull().default('KES'),
  isActive: boolean('is_active').notNull().default(true),
});

export const priceBars = pgTable('price_bars', {
  id: uuid('id').defaultRandom().primaryKey(),
  instrumentId: uuid('instrument_id').notNull().references(() => instruments.id),
  period: varchar('period', { length: 12 }).notNull().default('1d'),
  marketDate: timestamp('market_date', { withTimezone: true }).notNull(),
  open: numeric('open', { precision: 18, scale: 4 }).notNull(),
  high: numeric('high', { precision: 18, scale: 4 }).notNull(),
  low: numeric('low', { precision: 18, scale: 4 }).notNull(),
  close: numeric('close', { precision: 18, scale: 4 }).notNull(),
  volume: numeric('volume', { precision: 24, scale: 2 }).notNull().default('0'),
  source: varchar('source', { length: 120 }).notNull(),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull().defaultNow(),
  delayMinutes: integer('delay_minutes'),
  externalDisplayAllowed: boolean('external_display_allowed').notNull().default(false),
  status: varchar('status', { length: 20 }).notNull().default('demo'),
}, (t) => ({ uniqueMarketBar: uniqueIndex('price_bars_instrument_period_date_uq').on(t.instrumentId, t.period, t.marketDate), instrumentDateIdx: index('price_bars_instrument_date_idx').on(t.instrumentId, t.marketDate) }));

export const courses = pgTable('courses', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 140 }).notNull().unique(),
  title: varchar('title', { length: 180 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  level: varchar('level', { length: 40 }).notNull(),
  duration: varchar('duration', { length: 40 }).notNull(),
  lessonsCount: integer('lessons_count').notNull().default(0),
  published: boolean('published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lessons = pgTable('lessons', {
  id: uuid('id').defaultRandom().primaryKey(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  slug: varchar('slug', { length: 140 }).notNull(),
  title: varchar('title', { length: 180 }).notNull(),
  body: text('body').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  minutes: integer('minutes').notNull().default(8),
}, (t) => ({ courseSlugUq: uniqueIndex('lessons_course_slug_uq').on(t.courseId, t.slug) }));

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 180 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: varchar('file_type', { length: 30 }).notNull().default('application/pdf'),
  fileSize: integer('file_size').notNull().default(0),
  version: varchar('version', { length: 30 }).notNull().default('1.0'),
  published: boolean('published').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const briefings = pgTable('briefings', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 180 }).notNull().unique(),
  title: varchar('title', { length: 220 }).notNull(),
  summary: text('summary').notNull(),
  body: text('body').notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  sourceName: varchar('source_name', { length: 180 }).notNull(),
  sourceUrl: text('source_url'),
  marketDate: timestamp('market_date', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const watchlistItems = pgTable('watchlist_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  instrumentId: uuid('instrument_id').notNull().references(() => instruments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ userInstrumentUq: uniqueIndex('watchlist_user_instrument_uq').on(t.userId, t.instrumentId) }));

export const learningProgress = pgTable('learning_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ userLessonUq: uniqueIndex('learning_progress_user_lesson_uq').on(t.userId, t.lessonId) }));

export const virtualPortfolios = pgTable('virtual_portfolios', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  name: varchar('name', { length: 120 }).notNull().default('Learning Portfolio'),
  startingCash: numeric('starting_cash', { precision: 18, scale: 2 }).notNull().default('100000'),
  cashBalance: numeric('cash_balance', { precision: 18, scale: 2 }).notNull().default('100000'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const virtualTransactions = pgTable('virtual_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  portfolioId: uuid('portfolio_id').notNull().references(() => virtualPortfolios.id, { onDelete: 'cascade' }),
  instrumentId: uuid('instrument_id').notNull().references(() => instruments.id),
  side: varchar('side', { length: 8 }).notNull(),
  quantity: integer('quantity').notNull(),
  price: numeric('price', { precision: 18, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ingestionRuns = pgTable('ingestion_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: varchar('provider', { length: 100 }).notNull(),
  dataset: varchar('dataset', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  recordsRead: integer('records_read').notNull().default(0),
  recordsWritten: integer('records_written').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  action: varchar('action', { length: 120 }).notNull(),
  resourceType: varchar('resource_type', { length: 80 }).notNull(),
  resourceId: varchar('resource_id', { length: 160 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
