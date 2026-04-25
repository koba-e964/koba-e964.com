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

type RawHistoryRow = {
  event_at: string;
  kind: string;
  value: number | string | null;
  value_currency: string | null;
  note: string;
  prediction_business_date: string | null;
  index_date: string | null;
  index_value: number | string | null;
  index_event_at: string | null;
  fx_date: string | null;
  fx_value: number | string | null;
  fx_event_at: string | null;
};

function toNullableNumber(value: number | string | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

function isSamePrediction(
  left: RawHistoryRow | undefined,
  right: RawHistoryRow,
): boolean {
  if (!left) {
    return false;
  }

  return (
    left.kind === right.kind &&
    toNullableNumber(left.value) === toNullableNumber(right.value) &&
    toNullableNumber(left.index_value) ===
      toNullableNumber(right.index_value) &&
    toNullableNumber(left.fx_value) === toNullableNumber(right.fx_value)
  );
}

export function dedupePredictionHistory(
  rows: RawHistoryRow[],
): RawHistoryRow[] {
  const predictionRows = rows
    .filter((row) => row.prediction_business_date)
    .sort((left, right) => {
      const byBusinessDate = left.prediction_business_date!.localeCompare(
        right.prediction_business_date!,
      );
      if (byBusinessDate !== 0) {
        return byBusinessDate;
      }

      return left.event_at.localeCompare(right.event_at);
    });

  const predictionRowsToKeep = new Set<string>();
  let previousKeptPrediction: RawHistoryRow | undefined;

  for (const row of predictionRows) {
    if (isSamePrediction(previousKeptPrediction, row)) {
      continue;
    }

    predictionRowsToKeep.add(
      `${row.kind}:${row.prediction_business_date}:${row.event_at}`,
    );
    previousKeptPrediction = row;
  }

  return rows.filter((row) => {
    if (!row.prediction_business_date) {
      return true;
    }

    return predictionRowsToKeep.has(
      `${row.kind}:${row.prediction_business_date}:${row.event_at}`,
    );
  });
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
  const historyRows = (await sql`
    with combined as (
      select fetched_at as event_at, 'official'::text as kind, nav::double precision as value, 'JPY'::text as value_currency, '公式基準価額'::text as note,
        null::date as prediction_business_date,
        null::date as index_date, null::double precision as index_value, null::timestamptz as index_event_at,
        null::date as fx_date, null::double precision as fx_value, null::timestamptz as fx_event_at
      from fund_nav_daily
      where fund_code = ${fundCode}
      union all
      select p.computed_at as event_at, p.status::text as kind, p.predicted_nav::double precision as value, 'JPY'::text as value_currency, p.confidence_note::text as note,
        p.business_date as prediction_business_date,
        p.predicted_from_trade_date as index_date, p.used_index_value::double precision as index_value, idx.fetched_at as index_event_at,
        p.predicted_from_fx_date as fx_date, p.used_ttm::double precision as fx_value, fx.fetched_at as fx_event_at
      from fund_predictions_daily p
      left join lateral (
        select fetched_at
        from market_index_daily
        where symbol = '^GSPC'
          and trade_date = p.predicted_from_trade_date
          and close_value = p.used_index_value
          and fetched_at <= p.computed_at
        order by fetched_at desc
        limit 1
      ) idx on true
      left join lateral (
        select fetched_at
        from fx_daily
        where currency_pair = 'USD/JPY'
          and business_date = p.predicted_from_fx_date
          and ttm = p.used_ttm
          and fetched_at <= p.computed_at
        order by fetched_at desc
        limit 1
      ) fx on true
      where p.fund_code = ${fundCode}
      union all
      select fetched_at as event_at, 'market_index'::text as kind, close_value::double precision as value, 'USD'::text as value_currency, 'S&P 500 終値'::text as note,
        null::date as prediction_business_date,
        null::date as index_date, null::double precision as index_value, null::timestamptz as index_event_at,
        null::date as fx_date, null::double precision as fx_value, null::timestamptz as fx_event_at
      from market_index_daily
      where symbol = '^GSPC'
      union all
      select fetched_at as event_at, 'fx_ttm'::text as kind, ttm::double precision as value, 'FX'::text as value_currency, '為替TTM'::text as note,
        null::date as prediction_business_date,
        null::date as index_date, null::double precision as index_value, null::timestamptz as index_event_at,
        null::date as fx_date, null::double precision as fx_value, null::timestamptz as fx_event_at
      from fx_daily
      where currency_pair = 'USD/JPY'
    )
    select event_at, kind, value, value_currency, note, prediction_business_date, index_date, index_value, index_event_at, fx_date, fx_value, fx_event_at
    from combined
    order by event_at desc
    limit 90
  `) as RawHistoryRow[];

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
    history: dedupePredictionHistory(historyRows)
      .sort((left, right) => right.event_at.localeCompare(left.event_at))
      .slice(0, 30)
      .map((row) => ({
        eventAt: row.event_at,
        kind: row.kind as PublicLatestPayload["history"][number]["kind"],
        value: toNullableNumber(row.value),
        valueCurrency:
          row.value_currency === "JPY" ||
          row.value_currency === "USD" ||
          row.value_currency === "FX"
            ? row.value_currency
            : undefined,
        note: row.note,
        indexDate: row.index_date,
        indexValue: toNullableNumber(row.index_value),
        indexEventAt: row.index_event_at,
        fxDate: row.fx_date,
        fxValue: toNullableNumber(row.fx_value),
        fxEventAt: row.fx_event_at,
      })),
    assumptions: [
      "初版モデルは直近の公式基準価額をベースに指数比率と為替比率を掛けて近似する。",
      "信託報酬は一日先では無視し、長期予測では年率から日割り換算する。",
      "配当込み円換算ベースとの差は method_version を上げて改善できるようにしている。",
    ],
  };
}
