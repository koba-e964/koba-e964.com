import type {
  PredictionInput,
  PredictionResult,
  PredictionStatus,
} from "../types.js";

const METHOD_VERSION = "v2-tr-index-fx-fee";

function daysBetween(baseDate: string, targetDate: string): number {
  const base = new Date(`${baseDate}T00:00:00Z`).getTime();
  const target = new Date(`${targetDate}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((target - base) / 86400000));
}

function computeFeeFactor(annualFeeRate: number, daySpan: number): number {
  if (daySpan <= 1) {
    return 1;
  }
  return Math.pow(1 - annualFeeRate, daySpan / 365);
}

function resolveStatus(
  hasIndex: boolean,
  hasFx: boolean,
  daySpan: number,
): PredictionStatus {
  if (daySpan > 1) {
    return "estimated_long_horizon";
  }
  if (hasIndex && hasFx) {
    return "estimated_complete_inputs";
  }
  if (!hasIndex) {
    return "estimated_missing_index";
  }
  return "estimated_missing_fx";
}

export function buildPrediction(
  input: PredictionInput,
  computedAt = new Date().toISOString(),
): PredictionResult {
  const baseNav = input.baseNav.nav;
  const hasIndex = Boolean(input.baseIndex && input.targetIndex);
  const hasFx = Boolean(input.baseFx && input.targetFx);
  const indexRatio =
    hasIndex && input.baseIndex && input.targetIndex
      ? input.targetIndex.closeValue / input.baseIndex.closeValue
      : 1;
  const fxRatio =
    hasFx && input.baseFx && input.targetFx
      ? input.targetFx.ttm / input.baseFx.ttm
      : 1;
  const daySpan = daysBetween(
    input.baseNav.businessDate,
    input.targetBusinessDate,
  );
  const feeAdjustmentFactor = computeFeeFactor(
    input.fund.annualFeeRate,
    daySpan,
  );
  const predictedNav = Number(
    (baseNav * indexRatio * fxRatio * feeAdjustmentFactor).toFixed(2),
  );
  const status = resolveStatus(hasIndex, hasFx, daySpan);

  const notes = [];
  if (hasIndex) {
    notes.push("S&P 500 反映済み");
  } else {
    notes.push("S&P 500 は未反映");
  }
  if (hasFx) {
    notes.push("TTM 反映済み");
  } else {
    notes.push("TTM は未反映");
  }
  if (daySpan > 1) {
    notes.push("長期補正として信託報酬を日割りで減算");
  }

  return {
    fundCode: input.fund.code,
    businessDate: input.targetBusinessDate,
    status,
    predictedNav,
    predictedFromTradeDate: input.targetIndex?.tradeDate ?? null,
    predictedFromFxDate: input.targetFx?.businessDate ?? null,
    usedIndexValue: input.targetIndex?.closeValue ?? null,
    usedTtm: input.targetFx?.ttm ?? null,
    feeAdjustmentFactor,
    methodVersion: METHOD_VERSION,
    confidenceNote: notes.join(" / "),
    computedAt,
  };
}
