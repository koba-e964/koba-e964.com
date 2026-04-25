import assert from "node:assert/strict";
import test from "node:test";

import { dedupePredictionHistory, isSamePredictionContent } from "../src/db.js";
import type { PredictionResult } from "../src/types.js";

test("dedupePredictionHistory keeps the earliest identical prediction row", () => {
  const rows = [
    {
      event_at: "2026-04-25T00:40:28.416Z",
      kind: "estimated_complete_inputs",
      value: 41675,
      value_currency: "JPY",
      note: "S&P 500 と TTM が反映済み。",
      prediction_business_date: "2026-04-24",
      index_date: "2026-04-24",
      index_value: 7165.08,
      index_event_at: "2026-04-25T00:35:32.862Z",
      fx_date: "2026-04-24",
      fx_value: 159.84,
      fx_event_at: "2026-04-25T00:35:32.610Z",
    },
    {
      event_at: "2026-04-25T00:35:32.000Z",
      kind: "estimated_complete_inputs",
      value: 41675,
      value_currency: "JPY",
      note: "S&P 500 と TTM が反映済み。",
      prediction_business_date: "2026-04-23",
      index_date: "2026-04-23",
      index_value: 7165.08,
      index_event_at: null,
      fx_date: "2026-04-23",
      fx_value: 159.84,
      fx_event_at: null,
    },
    {
      event_at: "2026-04-24T06:35:00.000Z",
      kind: "market_index",
      value: 7165.08,
      value_currency: "USD",
      note: "S&P 500 終値",
      prediction_business_date: null,
      index_date: null,
      index_value: null,
      index_event_at: null,
      fx_date: null,
      fx_value: null,
      fx_event_at: null,
    },
  ];

  const deduped = dedupePredictionHistory(rows);

  assert.equal(deduped.length, 2);
  assert.equal(
    deduped.find((row) => row.kind === "estimated_complete_inputs")
      ?.prediction_business_date,
    "2026-04-23",
  );
});

test("dedupePredictionHistory keeps later prediction rows when inputs change", () => {
  const rows = [
    {
      event_at: "2026-04-25T00:40:28.416Z",
      kind: "estimated_complete_inputs",
      value: 41710,
      value_currency: "JPY",
      note: "S&P 500 と TTM が反映済み。",
      prediction_business_date: "2026-04-24",
      index_date: "2026-04-24",
      index_value: 7170.22,
      index_event_at: "2026-04-25T00:35:32.862Z",
      fx_date: "2026-04-24",
      fx_value: 159.84,
      fx_event_at: "2026-04-25T00:35:32.610Z",
    },
    {
      event_at: "2026-04-25T00:35:32.000Z",
      kind: "estimated_complete_inputs",
      value: 41675,
      value_currency: "JPY",
      note: "S&P 500 と TTM が反映済み。",
      prediction_business_date: "2026-04-23",
      index_date: "2026-04-23",
      index_value: 7165.08,
      index_event_at: null,
      fx_date: "2026-04-23",
      fx_value: 159.84,
      fx_event_at: null,
    },
  ];

  const deduped = dedupePredictionHistory(rows);

  assert.equal(deduped.length, 2);
});

test("dedupePredictionHistory keeps the oldest estimate when recomputation changes date order", () => {
  const rows = [
    {
      event_at: "2026-04-25T00:50:00.000Z",
      kind: "estimated_complete_inputs",
      value: 41675,
      value_currency: "JPY",
      note: "S&P 500 と TTM が反映済み。",
      prediction_business_date: "2026-04-23",
      index_date: "2026-04-23",
      index_value: 7165.08,
      index_event_at: null,
      fx_date: "2026-04-23",
      fx_value: 159.84,
      fx_event_at: null,
    },
    {
      event_at: "2026-04-25T00:35:32.000Z",
      kind: "estimated_complete_inputs",
      value: 41675,
      value_currency: "JPY",
      note: "S&P 500 と TTM が反映済み。",
      prediction_business_date: "2026-04-24",
      index_date: "2026-04-24",
      index_value: 7165.08,
      index_event_at: null,
      fx_date: "2026-04-24",
      fx_value: 159.84,
      fx_event_at: null,
    },
  ];

  const deduped = dedupePredictionHistory(rows);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]?.event_at, "2026-04-25T00:35:32.000Z");
  assert.equal(deduped[0]?.prediction_business_date, "2026-04-24");
});

test("isSamePredictionContent compares only the latest prediction payload", () => {
  const latestStored = {
    status: "estimated_complete_inputs",
    predicted_nav: 41675,
    predicted_from_trade_date: "2026-04-23T00:00:00.000Z",
    predicted_from_fx_date: "2026-04-23T00:00:00.000Z",
    used_index_value: 7165.08,
    used_ttm: 159.84,
    fee_adjustment_factor: 1,
    confidence_note: "S&P 500 反映済み / TTM 反映済み",
  };
  const nextPrediction: PredictionResult = {
    fundCode: "253266",
    businessDate: "2026-04-25",
    status: "estimated_complete_inputs",
    predictedNav: 41675,
    predictedFromTradeDate: "2026-04-23",
    predictedFromFxDate: "2026-04-23",
    usedIndexValue: 7165.08,
    usedTtm: 159.84,
    feeAdjustmentFactor: 1,
    methodVersion: "v1",
    confidenceNote: "S&P 500 反映済み / TTM 反映済み",
    computedAt: "2026-04-25T00:35:32.000Z",
  };

  assert.equal(isSamePredictionContent(latestStored, nextPrediction), true);
});

test("isSamePredictionContent allows values that only match old history", () => {
  const latestStored = {
    status: "estimated_complete_inputs",
    predicted_nav: 41725,
    predicted_from_trade_date: "2026-04-22T00:00:00.000Z",
    predicted_from_fx_date: "2026-04-22T00:00:00.000Z",
    used_index_value: 7108.4,
    used_ttm: 159.37,
    fee_adjustment_factor: 1,
    confidence_note: "S&P 500 反映済み / TTM 反映済み",
  };
  const oldLikePrediction: PredictionResult = {
    fundCode: "253266",
    businessDate: "2029-01-01",
    status: "estimated_complete_inputs",
    predictedNav: 41675,
    predictedFromTradeDate: "2026-04-23",
    predictedFromFxDate: "2026-04-23",
    usedIndexValue: 7165.08,
    usedTtm: 159.84,
    feeAdjustmentFactor: 1,
    methodVersion: "v1",
    confidenceNote: "S&P 500 反映済み / TTM 反映済み",
    computedAt: "2029-01-01T00:00:00.000Z",
  };

  assert.equal(isSamePredictionContent(latestStored, oldLikePrediction), false);
});
