import { z } from 'zod';

export const MarketBarSchema = z.object({
  symbol: z.string().trim().min(1).max(24),
  marketDate: z.coerce.date(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
  currency: z.string().length(3),
  source: z.string().min(2).max(120),
  retrievedAt: z.coerce.date(),
  delayMinutes: z.number().int().nonnegative().nullable(),
  externalDisplayAllowed: z.boolean(),
});
export type MarketBar = z.infer<typeof MarketBarSchema>;
export interface MarketDataProvider {
  readonly name: string;
  fetchDailyBars(): Promise<unknown[]>;
}

/** The demo provider deliberately returns no quote data. UI demo fixtures are not ingestion records. */
export class DemoMarketDataProvider implements MarketDataProvider {
  readonly name = 'MaliScope demo adapter';
  async fetchDailyBars(): Promise<unknown[]> { return []; }
}

export function createMarketDataProvider(): MarketDataProvider {
  const selected = (process.env.MARKET_DATA_PROVIDER || 'demo').toLowerCase();
  if (selected === 'demo') return new DemoMarketDataProvider();
  throw new Error(`Provider adapter "${selected}" is not implemented. Do not set it until its commercial data entitlement and adapter have been verified.`);
}

export function validateBars(input: unknown[]): MarketBar[] {
  const parsed = z.array(MarketBarSchema).safeParse(input);
  if (!parsed.success) throw new Error(`Market data validation failed: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
  for (const bar of parsed.data) {
    if (bar.high < Math.max(bar.open, bar.close, bar.low)) throw new Error(`Invalid OHLC range for ${bar.symbol}: high is inconsistent.`);
    if (bar.low > Math.min(bar.open, bar.close, bar.high)) throw new Error(`Invalid OHLC range for ${bar.symbol}: low is inconsistent.`);
    if (!bar.externalDisplayAllowed) throw new Error(`Provider entitlement does not allow external display for ${bar.symbol}.`);
  }
  const unique = new Set(parsed.data.map((bar) => `${bar.symbol}:${bar.marketDate.toISOString()}`));
  if (unique.size !== parsed.data.length) throw new Error('Duplicate instrument/date rows detected in market data batch.');
  return parsed.data;
}
