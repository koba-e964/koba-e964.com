import type { ScheduledHandler } from "aws-lambda";

import { getConfig } from "../config.js";
import { getSql, upsertPrediction } from "../db.js";
import { buildPrediction } from "../domain/predict.js";
import type {
  FundRecord,
  FxDailyRecord,
  MarketIndexDailyRecord,
} from "../types.js";

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

export const handler: ScheduledHandler = async () => {
  const config = await getConfig();
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

  const prediction = buildPrediction({
    fund: mapFund(fund),
    baseNav: {
      fundCode: String(baseNav.fund_code),
      businessDate: String(baseNav.business_date),
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
    targetBusinessDate: nextBusinessDate(String(baseNav.business_date)),
  });

  await upsertPrediction(config.databaseUrl, prediction);
};

function nextBusinessDate(yyyyMmDd: string): string {
  const next = new Date(`${yyyyMmDd}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function mapIndex(row: Record<string, unknown>): MarketIndexDailyRecord {
  return {
    tradeDate: String(row.trade_date),
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
    businessDate: String(row.business_date),
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
