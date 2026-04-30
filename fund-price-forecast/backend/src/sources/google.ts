import type { MarketIndexDailyRecord } from "../types.js";

const SOURCE_NAME = "Google Finance";
const NEW_YORK_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function extractNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function getNewYorkParts(fetchedAt: string): {
  date: string;
  weekday: string;
  hour: number;
} {
  const parts = NEW_YORK_DATE_FORMATTER.formatToParts(new Date(fetchedAt));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = parts.find((part) => part.type === "hour")?.value;
  if (!year || !month || !day || !weekday || !hour) {
    throw new Error(`Unable to infer New York trade date from ${fetchedAt}`);
  }
  return {
    date: `${year}-${month}-${day}`,
    weekday,
    hour: Number(hour),
  };
}

function previousBusinessDate(yyyyMmDd: string): string {
  const cursor = new Date(`${yyyyMmDd}T00:00:00Z`);
  do {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  } while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6);
  return cursor.toISOString().slice(0, 10);
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractGoogleQuoteKey(sourceUrl: string): {
  quoteCode: string;
  exchangeCode: string;
} {
  const url = new URL(sourceUrl);
  const match = url.pathname.match(/\/quote\/([^:/]+):([^/]+)/);
  if (!match) {
    throw new Error(
      `Unable to infer Google Finance quote key from ${sourceUrl}`,
    );
  }
  return {
    quoteCode: decodeURIComponent(match[1]),
    exchangeCode: decodeURIComponent(match[2]),
  };
}

export function parseGoogleSp500Html(
  html: string,
  sourceUrl: string,
  fetchedAt: string,
  symbol = "^GSPC",
): MarketIndexDailyRecord {
  const ny = getNewYorkParts(fetchedAt);
  const { quoteCode, exchangeCode } = extractGoogleQuoteKey(sourceUrl);
  const targetPattern = new RegExp(
    String.raw`\[\["[^"]+",\["${escapeRegExp(quoteCode)}","${escapeRegExp(exchangeCode)}"\],"[^"]+",1,null,\[([^\]]+)\],null,([^,\]]+),null,null,null,\[([^\]]+)\],"([^"]+)",(-?\d+)`,
    "s",
  );
  const targetMatch = html.match(targetPattern);
  const currentSeries = targetMatch?.[1]?.split(",") ?? [];
  const currentPriceRaw = currentSeries[0];
  const previousCloseRaw = targetMatch?.[2];
  const usePreviousClose =
    ny.weekday === "Sat" || ny.weekday === "Sun" || ny.hour < 16;
  const selectedPriceRaw = usePreviousClose
    ? previousCloseRaw
    : currentPriceRaw;

  if (!selectedPriceRaw) {
    console.error("Google Finance S&P 500 parse failed", {
      sourceUrl,
      usePreviousClose,
      titleSnippet:
        html.match(/<title[^>]*>[\s\S]{0,160}<\/title>/i)?.[0] ?? null,
      quoteSnippet:
        html.match(
          new RegExp(
            String.raw`${escapeRegExp(quoteCode)}","${escapeRegExp(exchangeCode)}"[\s\S]{0,600}`,
          ),
        )?.[0] ?? null,
    });
    throw new Error("Unable to parse Google Finance S&P 500 HTML");
  }

  return {
    tradeDate: usePreviousClose ? previousBusinessDate(ny.date) : ny.date,
    symbol,
    closeValue: extractNumber(selectedPriceRaw),
    currency: "USD",
    sourceName: SOURCE_NAME,
    sourceUrl,
    fetchedAt,
    rawPayload: html,
  };
}

export async function fetchGoogleSp500(
  sourceUrl: string,
  symbol = "^GSPC",
): Promise<MarketIndexDailyRecord> {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "fund-price-forecast/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Google Finance source request failed with ${response.status}`,
    );
  }
  const html = await response.text();
  return parseGoogleSp500Html(
    html,
    sourceUrl,
    new Date().toISOString(),
    symbol,
  );
}
