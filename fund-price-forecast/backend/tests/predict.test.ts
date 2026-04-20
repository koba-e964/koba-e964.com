import test from "node:test";
import assert from "node:assert/strict";

import { buildPrediction } from "../src/domain/predict.js";
import type { PredictionInput } from "../src/types.js";

const baseInput: PredictionInput = {
  fund: {
    id: 1,
    code: "253266",
    slug: "253266",
    displayName: "eMAXIS Slim 米国株式（S&P500）",
    providerName: "三菱UFJアセットマネジメント",
    sourceUrl: "https://emaxis.am.mufg.jp/fund/253266.html",
    benchmarkKind: "S&P500 total return JPY proxy",
    annualFeeRate: 0.00093,
    currency: "JPY",
  },
  baseNav: {
    fundCode: "253266",
    businessDate: "2026-04-13",
    nav: 35510,
    sourceName: "eMAXIS",
    sourceUrl: "https://emaxis.am.mufg.jp/fund/253266.html",
    fetchedAt: "2026-04-13T10:15:00+09:00",
    rawPayload: "fixture",
  },
  baseIndex: {
    tradeDate: "2026-04-10",
    symbol: "^GSPC",
    closeValue: 5200,
    currency: "USD",
    sourceName: "Yahoo!ファイナンス",
    sourceUrl: "https://finance.yahoo.co.jp/quote/%5EGSPC",
    fetchedAt: "2026-04-13T07:00:00+09:00",
    rawPayload: "fixture",
  },
  targetIndex: {
    tradeDate: "2026-04-10",
    symbol: "^GSPC",
    closeValue: 5304,
    currency: "USD",
    sourceName: "Yahoo!ファイナンス",
    sourceUrl: "https://finance.yahoo.co.jp/quote/%5EGSPC",
    fetchedAt: "2026-04-13T07:00:00+09:00",
    rawPayload: "fixture",
  },
  baseFx: {
    businessDate: "2026-04-13",
    currencyPair: "USD/JPY",
    tts: 145,
    ttb: 143,
    ttm: 144,
    sourceName: "MUFG TTM",
    sourceUrl: "https://www.bk.mufg.jp/ippan/kinri/list_j/kinri/kawase.html",
    fetchedAt: "2026-04-13T09:00:00+09:00",
    rawPayload: "fixture",
  },
  targetFx: {
    businessDate: "2026-04-14",
    currencyPair: "USD/JPY",
    tts: 146,
    ttb: 144,
    ttm: 145,
    sourceName: "MUFG TTM",
    sourceUrl: "https://www.bk.mufg.jp/ippan/kinri/list_j/kinri/kawase.html",
    fetchedAt: "2026-04-14T09:00:00+09:00",
    rawPayload: "fixture",
  },
  targetBusinessDate: "2026-04-14",
};

test("buildPrediction uses index and fx ratios for one-day forecast", () => {
  const prediction = buildPrediction(baseInput, "2026-04-13T12:00:00Z");
  assert.equal(prediction.status, "estimated_complete_inputs");
  assert.equal(prediction.predictedNav, 36471.73);
  assert.equal(prediction.feeAdjustmentFactor, 1);
});

test("buildPrediction marks missing index separately", () => {
  const prediction = buildPrediction({
    ...baseInput,
    baseIndex: null,
    targetIndex: null,
  });
  assert.equal(prediction.status, "estimated_missing_index");
  assert.equal(prediction.usedIndexValue, null);
});

test("buildPrediction applies fee factor on longer horizons", () => {
  const prediction = buildPrediction({
    ...baseInput,
    targetBusinessDate: "2026-05-13",
  });
  assert.equal(prediction.status, "estimated_long_horizon");
  assert.ok(prediction.feeAdjustmentFactor < 1);
});
