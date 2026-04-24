import { neon } from "@neondatabase/serverless";

import type {
  FundNavDailyRecord,
  FxDailyRecord,
  MarketIndexDailyRecord,
  PredictionResult,
  PublicLatestPayload,
} from "./types.js";

export function getSql(databaseUrl: string) {
  return neon(databaseUrl);
}

export async function upsertMarketIndex(
  databaseUrl: string,
  record: MarketIndexDailyRecord,
): Promise<void> {
  const sql = getSql(databaseUrl);
  await sql`
    insert into market_index_daily (
      trade_date, symbol, close_value, currency, source_name, source_url, fetched_at, raw_payload
    ) values (
      ${record.tradeDate}, ${record.symbol}, ${record.closeValue}, ${record.currency},
      ${record.sourceName}, ${record.sourceUrl}, ${record.fetchedAt}, ${record.rawPayload}
    )
    on conflict (symbol, trade_date) do update set
      close_value = excluded.close_value,
      currency = excluded.currency,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      fetched_at = excluded.fetched_at,
      raw_payload = excluded.raw_payload
  `;
}

export async function upsertFx(
  databaseUrl: string,
  record: FxDailyRecord,
): Promise<void> {
  const sql = getSql(databaseUrl);
  await sql`
    insert into fx_daily (
      business_date, currency_pair, tts, ttb, ttm, source_name, source_url, fetched_at, raw_payload
    ) values (
      ${record.businessDate}, ${record.currencyPair}, ${record.tts}, ${record.ttb}, ${record.ttm},
      ${record.sourceName}, ${record.sourceUrl}, ${record.fetchedAt}, ${record.rawPayload}
    )
    on conflict (currency_pair, business_date) do update set
      tts = excluded.tts,
      ttb = excluded.ttb,
      ttm = excluded.ttm,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      fetched_at = excluded.fetched_at,
      raw_payload = excluded.raw_payload
  `;
}

export async function upsertFundNav(
  databaseUrl: string,
  record: FundNavDailyRecord,
): Promise<void> {
  const sql = getSql(databaseUrl);
  await sql`
    insert into fund_nav_daily (
      fund_code, business_date, nav, source_name, source_url, fetched_at, raw_payload
    ) values (
      ${record.fundCode}, ${record.businessDate}, ${record.nav}, ${record.sourceName},
      ${record.sourceUrl}, ${record.fetchedAt}, ${record.rawPayload}
    )
    on conflict (fund_code, business_date) do update set
      nav = excluded.nav,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      fetched_at = excluded.fetched_at,
      raw_payload = excluded.raw_payload
  `;
}

export async function upsertPrediction(
  databaseUrl: string,
  record: PredictionResult,
): Promise<void> {
  const sql = getSql(databaseUrl);
  await sql`
    insert into fund_predictions_daily (
      fund_code, business_date, status, predicted_nav, predicted_from_trade_date,
      predicted_from_fx_date, used_index_value, used_ttm, fee_adjustment_factor,
      method_version, confidence_note, computed_at
    ) values (
      ${record.fundCode}, ${record.businessDate}, ${record.status}, ${record.predictedNav},
      ${record.predictedFromTradeDate}, ${record.predictedFromFxDate}, ${record.usedIndexValue},
      ${record.usedTtm}, ${record.feeAdjustmentFactor}, ${record.methodVersion},
      ${record.confidenceNote}, ${record.computedAt}
    )
    on conflict (fund_code, business_date, method_version) do update set
      status = excluded.status,
      predicted_nav = excluded.predicted_nav,
      predicted_from_trade_date = excluded.predicted_from_trade_date,
      predicted_from_fx_date = excluded.predicted_from_fx_date,
      used_index_value = excluded.used_index_value,
      used_ttm = excluded.used_ttm,
      fee_adjustment_factor = excluded.fee_adjustment_factor,
      confidence_note = excluded.confidence_note,
      computed_at = excluded.computed_at
  `;
}

export async function getPublicLatestPayload(
  databaseUrl: string,
  fundCode: string,
): Promise<PublicLatestPayload | null> {
  const sql = getSql(databaseUrl);
  const funds = await sql`
    select code, display_name, provider_name, annual_fee_rate
    from funds
    where code = ${fundCode}
    limit 1
  `;
  if (funds.length === 0) {
    return null;
  }

  const [latestOfficialNav] = await sql`
    select business_date, nav, fetched_at
    from fund_nav_daily
    where fund_code = ${fundCode}
    order by business_date desc
    limit 1
  `;
  const [latestPrediction] = await sql`
    select business_date, status, predicted_nav, confidence_note
    from fund_predictions_daily
    where fund_code = ${fundCode}
    order by business_date desc, computed_at desc
    limit 1
  `;
  const [latestSp500] = await sql`
    select trade_date, close_value, source_name, fetched_at
    from market_index_daily
    where symbol = '^GSPC'
    order by trade_date desc
    limit 1
  `;
  const [latestFx] = await sql`
    select business_date, tts, ttb, ttm
    from fx_daily
    where currency_pair = 'USD/JPY'
    order by business_date desc
    limit 1
  `;
  const historyRows = await sql`
    with combined as (
      select fetched_at as event_at, 'official'::text as kind, nav::double precision as value, 'JPY'::text as value_currency, '公式基準価額'::text as note,
        null::date as index_date, null::double precision as index_value, null::date as fx_date, null::double precision as fx_value
      from fund_nav_daily
      where fund_code = ${fundCode}
      union all
      select computed_at as event_at, status::text as kind, predicted_nav::double precision as value, 'JPY'::text as value_currency, confidence_note::text as note,
        predicted_from_trade_date as index_date, used_index_value::double precision as index_value,
        predicted_from_fx_date as fx_date, used_ttm::double precision as fx_value
      from fund_predictions_daily
      where fund_code = ${fundCode}
      union all
      select fetched_at as event_at, 'market_index'::text as kind, close_value::double precision as value, 'USD'::text as value_currency, 'S&P 500 終値'::text as note,
        null::date as index_date, null::double precision as index_value, null::date as fx_date, null::double precision as fx_value
      from market_index_daily
      where symbol = '^GSPC'
      union all
      select fetched_at as event_at, 'fx_ttm'::text as kind, ttm::double precision as value, 'FX'::text as value_currency, '為替TTM'::text as note,
        null::date as index_date, null::double precision as index_value, null::date as fx_date, null::double precision as fx_value
      from fx_daily
      where currency_pair = 'USD/JPY'
    )
    select event_at, kind, value, value_currency, note, index_date, index_value, fx_date, fx_value
    from combined
    order by event_at desc
    limit 30
  `;

  if (!latestOfficialNav || !latestPrediction || !latestSp500 || !latestFx) {
    return null;
  }

  return {
    fund: {
      code: funds[0].code,
      displayName: funds[0].display_name,
      providerName: funds[0].provider_name,
      annualFeeRate: Number(funds[0].annual_fee_rate),
    },
    latestOfficialNav: {
      businessDate: latestOfficialNav.business_date,
      nav: Number(latestOfficialNav.nav),
      fetchedAt: latestOfficialNav.fetched_at,
    },
    latestPrediction: {
      businessDate: latestPrediction.business_date,
      status: latestPrediction.status,
      predictedNav: Number(latestPrediction.predicted_nav),
      confidenceNote: latestPrediction.confidence_note,
    },
    latestSources: {
      sp500: {
        tradeDate: latestSp500.trade_date,
        closeValue: Number(latestSp500.close_value),
        sourceName: latestSp500.source_name,
        fetchedAt: latestSp500.fetched_at,
      },
      ttm: {
        businessDate: latestFx.business_date,
        tts: Number(latestFx.tts),
        ttb: Number(latestFx.ttb),
        ttm: Number(latestFx.ttm),
      },
    },
    history: historyRows.map((row) => ({
      eventAt: row.event_at,
      kind: row.kind,
      value: row.value === null ? null : Number(row.value),
      valueCurrency:
        row.value_currency === "JPY" ||
        row.value_currency === "USD" ||
        row.value_currency === "FX"
          ? row.value_currency
          : undefined,
      note: row.note,
      indexDate: row.index_date,
      indexValue:
        row.index_value === null || row.index_value === undefined
          ? null
          : Number(row.index_value),
      fxDate: row.fx_date,
      fxValue:
        row.fx_value === null || row.fx_value === undefined
          ? null
          : Number(row.fx_value),
    })),
    assumptions: [
      "初版モデルは直近の公式基準価額をベースに指数比率と為替比率を掛けて近似する。",
      "信託報酬は一日先では無視し、長期予測では年率から日割り換算する。",
      "配当込み円換算ベースとの差は method_version を上げて改善できるようにしている。",
    ],
  };
}
