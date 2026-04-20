import type { AppConfig } from "./config.js";
import {
  getSql,
  upsertFundNav,
  upsertFx,
  upsertMarketIndex,
  upsertPrediction,
} from "./db.js";
import { buildPrediction } from "./domain/predict.js";
import { fetchEmaxisFundNav } from "./sources/emaxis.js";
import { fetchMufgFx } from "./sources/mufg.js";
import { fetchYahooSp500 } from "./sources/yahoo.js";
import type {
  FundRecord,
  FxDailyRecord,
  MarketIndexDailyRecord,
} from "./types.js";

export async function runIngestMarketData(config: AppConfig): Promise<void> {
  const [sp500, fx] = await Promise.all([
    fetchYahooSp500(config.sp500SourceUrl),
    fetchMufgFx(config.mufgFxUrl),
  ]);

  await Promise.all([
    upsertMarketIndex(config.databaseUrl, sp500),
    upsertFx(config.databaseUrl, fx),
  ]);
}

export async function runIngestFundNav(config: AppConfig): Promise<void> {
  const nav = await fetchEmaxisFundNav(config.fundSourceUrl, config.fundCode);
  await upsertFundNav(config.databaseUrl, nav);
}

export async function runRecomputePredictions(
  config: AppConfig,
): Promise<void> {
  const sql = getSql(config.databaseUrl);

  const [fund] =
    await sql`select * from funds where code = ${config.fundCode} limit 1`;
  const [baseNav] = await sql`
    select * from fund_nav_daily
    where fund_code = ${config.fundCode}
    order by business_date desc
    limit 1
  `;
  const [baseIndex] = await sql`
    select * from market_index_daily
    where symbol = '^GSPC'
      and trade_date <= ${baseNav.business_date}
    order by trade_date desc
    limit 1
  `;
  const [targetIndex] = await sql`
    select * from market_index_daily
    where symbol = '^GSPC'
    order by trade_date desc
    limit 1
  `;
  const [baseFx] = await sql`
    select * from fx_daily
    where currency_pair = 'USD/JPY'
      and business_date <= ${baseNav.business_date}
    order by business_date desc
    limit 1
  `;
  const [targetFx] = await sql`
    select * from fx_daily
    where currency_pair = 'USD/JPY'
    order by business_date desc
    limit 1
  `;

  if (!fund || !baseNav) {
    throw new Error(
      "Cannot compute prediction without fund row and official NAV",
    );
  }
  if (!baseIndex && !baseFx) {
    throw new Error(
      "Cannot compute prediction without any upstream market data",
    );
  }

  const baseNavBusinessDate = normalizeDateOnly(baseNav.business_date);

  const prediction = buildPrediction({
    fund: mapFund(fund),
    baseNav: {
      fundCode: String(baseNav.fund_code),
      businessDate: baseNavBusinessDate,
      nav: Number(baseNav.nav),
      sourceName: String(baseNav.source_name),
      sourceUrl: String(baseNav.source_url),
      fetchedAt: String(baseNav.fetched_at),
      rawPayload: String(baseNav.raw_payload),
    },
    baseIndex: baseIndex ? mapIndex(baseIndex) : null,
    targetIndex: targetIndex ? mapIndex(targetIndex) : null,
    baseFx: baseFx ? mapFx(baseFx) : null,
    targetFx: targetFx ? mapFx(targetFx) : null,
    targetBusinessDate: nextBusinessDate(baseNavBusinessDate),
  });

  await upsertPrediction(config.databaseUrl, prediction);
}

function nextBusinessDate(yyyyMmDd: string): string {
  const next = new Date(`${yyyyMmDd}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function normalizeDateOnly(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value);
  const isoDateMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) {
    return isoDateMatch[1];
  }

  const compactDateMatch = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactDateMatch) {
    return `${compactDateMatch[1]}-${compactDateMatch[2]}-${compactDateMatch[3]}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  throw new Error(`Unable to normalize date value: ${text}`);
}

function mapFund(row: Record<string, unknown>): FundRecord {
  return {
    id: Number(row.id),
    code: String(row.code),
    slug: String(row.slug),
    displayName: String(row.display_name),
    providerName: String(row.provider_name),
    sourceUrl: String(row.source_url),
    benchmarkKind: String(row.benchmark_kind),
    annualFeeRate: Number(row.annual_fee_rate),
    currency: "JPY",
  };
}

function mapIndex(row: Record<string, unknown>): MarketIndexDailyRecord {
  return {
    tradeDate: normalizeDateOnly(row.trade_date),
    symbol: String(row.symbol),
    closeValue: Number(row.close_value),
    currency: String(row.currency),
    sourceName: String(row.source_name),
    sourceUrl: String(row.source_url),
    fetchedAt: String(row.fetched_at),
    rawPayload: String(row.raw_payload),
  };
}

function mapFx(row: Record<string, unknown>): FxDailyRecord {
  return {
    businessDate: normalizeDateOnly(row.business_date),
    currencyPair: String(row.currency_pair),
    tts: Number(row.tts),
    ttb: Number(row.ttb),
    ttm: Number(row.ttm),
    sourceName: String(row.source_name),
    sourceUrl: String(row.source_url),
    fetchedAt: String(row.fetched_at),
    rawPayload: String(row.raw_payload),
  };
}
