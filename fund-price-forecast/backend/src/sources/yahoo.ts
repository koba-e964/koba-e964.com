import type { MarketIndexDailyRecord } from "../types.js";

const SOURCE_NAME = "Yahoo!ファイナンス";

function extractNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

export function parseYahooSp500Html(
  html: string,
  sourceUrl: string,
  fetchedAt: string,
): MarketIndexDailyRecord {
  const tradeDateMatch = html.match(/(\d{4}\/\d{2}\/\d{2})\s*(?:終値|更新)/);
  const priceMatch =
    html.match(/(?:現在値|前日終値|終値)[^0-9]{0,30}([0-9][0-9,]*\.[0-9]+)/) ||
    html.match(/([0-9][0-9,]*\.[0-9]+)\s*USD/);

  if (!tradeDateMatch || !priceMatch) {
    throw new Error("Unable to parse Yahoo S&P 500 HTML");
  }

  return {
    tradeDate: tradeDateMatch[1].replaceAll("/", "-"),
    symbol: "^GSPC",
    closeValue: extractNumber(priceMatch[1]),
    currency: "USD",
    sourceName: SOURCE_NAME,
    sourceUrl,
    fetchedAt,
    rawPayload: html,
  };
}

export async function fetchYahooSp500(
  sourceUrl: string,
): Promise<MarketIndexDailyRecord> {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "fund-price-forecast/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`Yahoo source request failed with ${response.status}`);
  }
  const html = await response.text();
  return parseYahooSp500Html(html, sourceUrl, new Date().toISOString());
}
