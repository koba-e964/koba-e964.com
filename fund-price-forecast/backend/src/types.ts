export type PredictionStatus =
  | "official"
  | "estimated_complete_inputs"
  | "estimated_missing_index"
  | "estimated_missing_fx"
  | "estimated_long_horizon";

export interface FundRecord {
  id: number;
  code: string;
  slug: string;
  displayName: string;
  providerName: string;
  sourceUrl: string;
  benchmarkKind: string;
  annualFeeRate: number;
  currency: "JPY";
}

export interface MarketIndexDailyRecord {
  tradeDate: string;
  symbol: string;
  closeValue: number;
  currency: string;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
  rawPayload: string;
}

export interface FxDailyRecord {
  businessDate: string;
  currencyPair: string;
  tts: number;
  ttb: number;
  ttm: number;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
  rawPayload: string;
}

export interface FundNavDailyRecord {
  fundCode: string;
  businessDate: string;
  nav: number;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
  rawPayload: string;
}

export interface PredictionInput {
  fund: FundRecord;
  baseNav: FundNavDailyRecord;
  baseIndex: MarketIndexDailyRecord | null;
  targetIndex: MarketIndexDailyRecord | null;
  baseFx: FxDailyRecord | null;
  targetFx: FxDailyRecord | null;
  targetBusinessDate: string;
}

export interface PredictionResult {
  fundCode: string;
  businessDate: string;
  status: PredictionStatus;
  predictedNav: number;
  predictedFromTradeDate: string | null;
  predictedFromFxDate: string | null;
  usedIndexValue: number | null;
  usedTtm: number | null;
  feeAdjustmentFactor: number;
  methodVersion: string;
  confidenceNote: string;
  computedAt: string;
}

export interface PublicLatestPayload {
  fund: {
    code: string;
    displayName: string;
    providerName: string;
    annualFeeRate: number;
  };
  latestOfficialNav: {
    businessDate: string;
    nav: number;
    fetchedAt: string;
  };
  latestPrediction: {
    businessDate: string;
    status: PredictionStatus;
    predictedNav: number;
    confidenceNote: string;
    formula: {
      baseNav: number;
      baseIndexValue: number | null;
      targetIndexValue: number | null;
      baseTtm: number | null;
      targetTtm: number | null;
      feeAdjustmentFactor: number;
    };
  };
  latestSources: {
    sp500: Pick<
      MarketIndexDailyRecord,
      "tradeDate" | "closeValue" | "sourceName" | "fetchedAt"
    >;
    ttm: Pick<FxDailyRecord, "businessDate" | "tts" | "ttb" | "ttm">;
  };
  history: Array<{
    eventAt: string;
    kind: PredictionStatus | "official" | "market_index" | "fx_ttm";
    value: number | null;
    valueCurrency?: "JPY" | "USD" | "FX";
    note: string;
    indexDate?: string | null;
    indexValue?: number | null;
    indexEventAt?: string | null;
    fxDate?: string | null;
    fxValue?: number | null;
    fxEventAt?: string | null;
    formula?: {
      baseNav: number;
      baseIndexValue: number | null;
      targetIndexValue: number | null;
      baseTtm: number | null;
      targetTtm: number | null;
      feeAdjustmentFactor: number;
    } | null;
  }>;
  assumptions: string[];
}
