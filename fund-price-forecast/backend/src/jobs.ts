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
import { fetchGoogleSp500 } from "./sources/google.js";
import type {
  FundRecord,
  FxDailyRecord,
  MarketIndexDailyRecord,
  PredictionResult,
} from "./types.js";

export async function runIngestMarketData(config: AppConfig): Promise<void> {
  const sp500 = await fetchGoogleSp500(
    config.sp500SourceUrl,
    config.sp500Symbol,
  );
  let fx: Awaited<ReturnType<typeof fetchMufgFx>> | null = null;

  try {
    fx = await fetchMufgFx(config.mufgFxUrl);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "MUFG FX quote not published yet"
    ) {
      console.warn(
        "Skipping FX ingest because today's quote is not published yet",
      );
    } else {
      throw error;
    }
  }

  await Promise.all([
    upsertMarketIndex(config.databaseUrl, sp500),
    fx ? upsertFx(config.databaseUrl, fx) : Promise.resolve(),
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
  const [baseNav] = await sql`
    select
      fund_code,
      business_date::text as business_date,
      nav,
      source_name,
      source_url,
      fetched_at,
      raw_payload
    from fund_nav_daily
    where fund_code = ${config.fundCode}
    order by business_date desc
    limit 1
  `;
  if (!baseNav) {
    throw new Error("Cannot compute prediction without official NAV");
  }
  const [latestFx] = await sql`
    select business_date::text as business_date
    from fx_daily
    where currency_pair = 'USD/JPY'
    order by business_date desc
    limit 1
  `;
  const prediction = await buildPredictionForBaseNav(
    config,
    baseNav,
    resolveTargetBusinessDate(
      normalizeDateOnly(baseNav.business_date),
      latestFx ? normalizeDateOnly(latestFx.business_date) : null,
    ),
  );
  await upsertPrediction(config.databaseUrl, prediction);
}

export async function runRecomputeAllPredictions(
  config: AppConfig,
): Promise<number> {
  const sql = getSql(config.databaseUrl);
  const baseNavRows = await sql`
    select
      fund_code,
      business_date::text as business_date,
      nav,
      source_name,
      source_url,
      fetched_at,
      raw_payload
    from fund_nav_daily
    where fund_code = ${config.fundCode}
    order by business_date asc
  `;

  let recomputed = 0;
  for (const baseNav of baseNavRows) {
    const [nextFx] = await sql`
      select business_date::text as business_date
      from fx_daily
      where currency_pair = 'USD/JPY'
        and business_date > ${baseNav.business_date}
      order by business_date asc
      limit 1
    `;
    const prediction = await buildPredictionForBaseNav(
      config,
      baseNav,
      resolveTargetBusinessDate(
        normalizeDateOnly(baseNav.business_date),
        nextFx ? normalizeDateOnly(nextFx.business_date) : null,
      ),
    );
    await upsertPrediction(config.databaseUrl, prediction);
    recomputed += 1;
  }

  return recomputed;
}

function nextBusinessDate(yyyyMmDd: string): string {
  const next = new Date(`${yyyyMmDd}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function resolveTargetBusinessDate(
  baseNavBusinessDate: string,
  latestFxBusinessDate: string | null,
): string {
  if (latestFxBusinessDate && latestFxBusinessDate > baseNavBusinessDate) {
    return latestFxBusinessDate;
  }

  return nextBusinessDate(baseNavBusinessDate);
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

async function buildPredictionForBaseNav(
  config: AppConfig,
  baseNavRow: Record<string, unknown>,
  targetBusinessDateOverride?: string,
): Promise<PredictionResult> {
  const sql = getSql(config.databaseUrl);
  const [fund] =
    await sql`select * from funds where code = ${config.fundCode} limit 1`;

  if (!fund) {
    throw new Error("Cannot compute prediction without fund row");
  }

  const baseNavBusinessDate = normalizeDateOnly(baseNavRow.business_date);
  const targetBusinessDate =
    targetBusinessDateOverride ?? nextBusinessDate(baseNavBusinessDate);

  const [baseIndex] = await sql`
    select
      trade_date::text as trade_date,
      symbol,
      close_value,
      currency,
      source_name,
      source_url,
      fetched_at,
      raw_payload
    from market_index_daily
    where symbol = ${config.sp500Symbol}
      and trade_date < ${baseNavRow.business_date}
    order by trade_date desc
    limit 1
  `;
  const [targetIndex] = await sql`
    select
      trade_date::text as trade_date,
      symbol,
      close_value,
      currency,
      source_name,
      source_url,
      fetched_at,
      raw_payload
    from market_index_daily
    where symbol = ${config.sp500Symbol}
      and trade_date < ${targetBusinessDate}
    order by trade_date desc
    limit 1
  `;
  const [baseFx] = await sql`
    select
      business_date::text as business_date,
      currency_pair,
      tts,
      ttb,
      ttm,
      source_name,
      source_url,
      fetched_at,
      raw_payload
    from fx_daily
    where currency_pair = 'USD/JPY'
      and business_date = ${baseNavRow.business_date}
    limit 1
  `;
  const [targetFx] = await sql`
    select
      business_date::text as business_date,
      currency_pair,
      tts,
      ttb,
      ttm,
      source_name,
      source_url,
      fetched_at,
      raw_payload
    from fx_daily
    where currency_pair = 'USD/JPY'
      and business_date = ${targetBusinessDate}
    limit 1
  `;

  if (!baseIndex && !baseFx) {
    throw new Error(
      `Cannot compute prediction for ${baseNavBusinessDate} without any upstream market data`,
    );
  }

  return buildPrediction(
    {
      fund: mapFund(fund),
      baseNav: {
        fundCode: String(baseNavRow.fund_code),
        businessDate: baseNavBusinessDate,
        nav: Number(baseNavRow.nav),
        sourceName: String(baseNavRow.source_name),
        sourceUrl: String(baseNavRow.source_url),
        fetchedAt: String(baseNavRow.fetched_at),
        rawPayload: String(baseNavRow.raw_payload),
      },
      baseIndex: baseIndex ? mapIndex(baseIndex) : null,
      targetIndex: targetIndex ? mapIndex(targetIndex) : null,
      baseFx: baseFx ? mapFx(baseFx) : null,
      targetFx: targetFx ? mapFx(targetFx) : null,
      targetBusinessDate,
    },
    inferComputedAt(baseNavRow, targetIndex, targetFx),
  );
}

function inferComputedAt(
  baseNavRow: Record<string, unknown>,
  targetIndex: Record<string, unknown> | undefined,
  targetFx: Record<string, unknown> | undefined,
): string {
  const timestamps = [
    baseNavRow.fetched_at,
    targetIndex?.fetched_at,
    targetFx?.fetched_at,
  ]
    .filter(Boolean)
    .map((value) => new Date(String(value)).getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) {
    return new Date().toISOString();
  }

  return new Date(Math.max(...timestamps)).toISOString();
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
