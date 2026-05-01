import type { MarketIndexDailyRecord } from "../types.js";

const SOURCE_NAME = "Yahoo Finance";
const NEW_YORK_NOW_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});
const NEW_YORK_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
};

function formatNewYorkDateFromTimestamp(timestampSeconds: number): string {
  const parts = NEW_YORK_DATE_FORMATTER.formatToParts(
    new Date(timestampSeconds * 1000),
  );
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`Unable to infer New York date from ${timestampSeconds}`);
  }
  return `${year}-${month}-${day}`;
}

function getNewYorkNowParts(fetchedAt: string): {
  date: string;
  weekday: string;
  hour: number;
} {
  const parts = NEW_YORK_NOW_FORMATTER.formatToParts(new Date(fetchedAt));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = parts.find((part) => part.type === "hour")?.value;
  if (!year || !month || !day || !weekday || !hour) {
    throw new Error(`Unable to infer New York time from ${fetchedAt}`);
  }
  return {
    date: `${year}-${month}-${day}`,
    weekday,
    hour: Number(hour),
  };
}

export function parseYahooSp500ChartJson(
  rawPayload: string,
  sourceUrl: string,
  fetchedAt: string,
  symbol = "^GSPC",
): MarketIndexDailyRecord {
  const payload = JSON.parse(rawPayload) as YahooChartPayload;
  const chart = payload.chart;
  if (chart?.error) {
    throw new Error(
      `Yahoo Finance chart returned ${chart.error.code ?? "error"}: ${chart.error.description ?? "unknown"}`,
    );
  }

  const result = chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const now = getNewYorkNowParts(fetchedAt);

  const series = timestamps
    .map((timestamp, index) => ({
      tradeDate: formatNewYorkDateFromTimestamp(timestamp),
      closeValue: closes[index],
    }))
    .filter(
      (entry): entry is { tradeDate: string; closeValue: number } =>
        typeof entry.closeValue === "number" &&
        Number.isFinite(entry.closeValue),
    );

  if (series.length === 0) {
    throw new Error("Unable to parse Yahoo Finance S&P 500 chart JSON");
  }

  let selected = series.at(-1);
  if (!selected) {
    throw new Error("Unable to select Yahoo Finance S&P 500 close");
  }

  if (
    selected.tradeDate === now.date &&
    now.weekday !== "Sat" &&
    now.weekday !== "Sun" &&
    now.hour < 16 &&
    series.length >= 2
  ) {
    selected = series.at(-2) ?? selected;
  }

  return {
    tradeDate: selected.tradeDate,
    symbol,
    closeValue: selected.closeValue,
    currency: "USD",
    sourceName: SOURCE_NAME,
    sourceUrl,
    fetchedAt,
    rawPayload,
  };
}

export async function fetchYahooSp500(
  sourceUrl: string,
  symbol = "^GSPC",
): Promise<MarketIndexDailyRecord> {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "fund-price-forecast/0.1",
      accept: "application/json,text/plain,*/*",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Yahoo Finance chart request failed with ${response.status}`,
    );
  }
  const rawPayload = await response.text();
  return parseYahooSp500ChartJson(
    rawPayload,
    sourceUrl,
    new Date().toISOString(),
    symbol,
  );
}
