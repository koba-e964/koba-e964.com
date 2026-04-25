import assert from "node:assert/strict";
import test from "node:test";

import { dedupePredictionHistory } from "../src/db.js";

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
