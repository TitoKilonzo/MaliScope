import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { and, eq, desc, lt } from 'drizzle-orm';
import { connectDatabase, closeDatabase, instruments, priceBars, ingestionRuns, briefings } from './index.js';
import { createMarketDataProvider, validateBars } from '../services/market-data.js';

const db = await connectDatabase();
if (!db) throw new Error('DATABASE_URL is required for market ingestion.');

try {
  const provider = createMarketDataProvider();
  const [run] = await db.insert(ingestionRuns).values({ provider: provider.name, dataset: 'daily-equity-bars', status: 'running' }).returning();
  try {
    const incoming = await provider.fetchDailyBars();
    if (!incoming.length) {
      await db.update(ingestionRuns).set({ status: 'skipped', recordsRead: 0, recordsWritten: 0, errorMessage: 'No authorised market-data provider is configured. Demo fixtures are not ingested as current prices.', completedAt: new Date() }).where(eq(ingestionRuns.id, run.id));
      console.log('No market data imported: provider is in demo mode.');
    } else {
      const bars = validateBars(incoming);
      const catalogue = await db.select().from(instruments);
      const instrumentsBySymbol = new Map(catalogue.map((item) => [item.symbol, item]));
      let written = 0;
      for (const bar of bars) {
        const instrument = instrumentsBySymbol.get(bar.symbol);
        if (!instrument) throw new Error(`Unknown market instrument: ${bar.symbol}`);
        if (bar.currency !== instrument.currency) throw new Error(`Currency mismatch for ${bar.symbol}: provider returned ${bar.currency}, catalogue expects ${instrument.currency}.`);
        await db.insert(priceBars).values({ instrumentId: instrument.id, period: '1d', marketDate: bar.marketDate, open: bar.open.toFixed(4), high: bar.high.toFixed(4), low: bar.low.toFixed(4), close: bar.close.toFixed(4), volume: bar.volume.toFixed(2), source: bar.source, retrievedAt: bar.retrievedAt, delayMinutes: bar.delayMinutes, externalDisplayAllowed: bar.externalDisplayAllowed, status: bar.delayMinutes === null ? 'realtime' : `delayed-${bar.delayMinutes}` }).onConflictDoUpdate({ target: [priceBars.instrumentId, priceBars.period, priceBars.marketDate], set: { open: bar.open.toFixed(4), high: bar.high.toFixed(4), low: bar.low.toFixed(4), close: bar.close.toFixed(4), volume: bar.volume.toFixed(2), source: bar.source, retrievedAt: bar.retrievedAt, delayMinutes: bar.delayMinutes, externalDisplayAllowed: bar.externalDisplayAllowed, status: bar.delayMinutes === null ? 'realtime' : `delayed-${bar.delayMinutes}` } });
        written += 1;
      }

      // Prepare a factual draft for editorial review. Never auto-publish a generated market report.
      const latestInstant = bars.reduce((latest, bar) => bar.marketDate > latest ? bar.marketDate : latest, bars[0].marketDate);
      const marketDay = latestInstant.toISOString().slice(0, 10);
      const dayBars = bars.filter((bar) => bar.marketDate.toISOString().slice(0, 10) === marketDay);
      const movers: Array<{ symbol: string; close: number; changePct: number }> = [];
      for (const bar of dayBars) {
        const instrument = instrumentsBySymbol.get(bar.symbol)!;
        const [previous] = await db.select({ close: priceBars.close }).from(priceBars)
          .where(and(eq(priceBars.instrumentId, instrument.id), eq(priceBars.period, '1d'), lt(priceBars.marketDate, bar.marketDate)))
          .orderBy(desc(priceBars.marketDate)).limit(1);
        if (previous && Number(previous.close) !== 0) {
          movers.push({ symbol: bar.symbol, close: bar.close, changePct: (bar.close / Number(previous.close) - 1) * 100 });
        }
      }
      const gainers = [...movers].filter((item) => item.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 3);
      const decliners = [...movers].filter((item) => item.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 3);
      const sourceNames = [...new Set(dayBars.map((bar) => bar.source))];
      const totalUnits = dayBars.reduce((sum, bar) => sum + bar.volume, 0);
      const summary = `Validated ${dayBars.length} daily instrument records for ${marketDay}; ${movers.length} have a prior trading-day close for comparison. Reported aggregate volume: ${totalUnits.toLocaleString('en-KE')} units.`;
      const body = [
        `Market date: ${marketDay}.`,
        `Data provider: ${provider.name}. Source labels in the imported records: ${sourceNames.join(', ')}.`,
        `Coverage: ${dayBars.length} instruments. ${movers.length} instruments have a previous close available for a percentage comparison. Aggregate reported volume: ${totalUnits.toLocaleString('en-KE')} units. This is a sum of units, not traded value.`,
        `Largest positive movements by percentage: ${gainers.length ? gainers.map((item) => `${item.symbol} closed at ${item.close.toFixed(2)} (${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%)`).join('; ') : 'No positive comparisons were available.'}`,
        `Largest negative movements by percentage: ${decliners.length ? decliners.map((item) => `${item.symbol} closed at ${item.close.toFixed(2)} (${item.changePct.toFixed(2)}%)`).join('; ') : 'No negative comparisons were available.'}`,
        'Editorial note: this draft is a factual summary of imported daily data. Confirm source entitlements, market timestamps, coverage and corporate actions before publication. It is not a forecast, trading signal or personalised investment recommendation.'
      ].join('\n\n');
      const slug = `nse-market-close-${marketDay}`;
      const [existingDraft] = await db.select().from(briefings).where(eq(briefings.slug, slug)).limit(1);
      if (!existingDraft) {
        await db.insert(briefings).values({ slug, title: `NSE market-close data briefing — ${marketDay}`, summary, body, category: 'Market data update', sourceName: provider.name, marketDate: latestInstant, status: 'draft' });
      } else if (existingDraft.status === 'draft') {
        await db.update(briefings).set({ summary, body, sourceName: provider.name, marketDate: latestInstant }).where(eq(briefings.id, existingDraft.id));
      }

      await db.update(ingestionRuns).set({ status: 'completed', recordsRead: incoming.length, recordsWritten: written, completedAt: new Date() }).where(eq(ingestionRuns.id, run.id));
      console.log(`Market data import completed: ${written} daily bars; editorial draft prepared for ${marketDay}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingestion error';
    await db.update(ingestionRuns).set({ status: 'failed', errorMessage: message, completedAt: new Date() }).where(eq(ingestionRuns.id, run.id));
    throw error;
  }
} finally {
  await closeDatabase();
}
