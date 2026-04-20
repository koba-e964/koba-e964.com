import type { MarketIndexDailyRecord } from "../types.js";

const SOURCE_NAME = "Yahoo!ファイナンス";
const NEW_YORK_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function extractNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function inferTradeDate(fetchedAt: string): string {
  const parts = NEW_YORK_DATE_FORMATTER.formatToParts(new Date(fetchedAt));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`Unable to infer New York trade date from ${fetchedAt}`);
  }
  return `${year}-${month}-${day}`;
}

export function parseYahooSp500Html(
  html: string,
  sourceUrl: string,
  fetchedAt: string,
): MarketIndexDailyRecord {
  const priceBoardSection =
    html.match(
      /<section id="mainIndexPriceBoard"[\s\S]{0,4000}<\/section>/,
    )?.[0] ?? html;
  const priceMatch =
    priceBoardSection.match(
      /(?:現在値|前日終値|終値)[^0-9]{0,30}([0-9][0-9,]*\.[0-9]+)/,
    ) ||
    priceBoardSection.match(
      /_CommonPriceBoard__price_[^"]*[\s\S]{0,200}?_StyledNumber__value_[^"]*">([0-9][0-9,]*\.[0-9]+)/,
    ) ||
    priceBoardSection.match(
      /_StyledNumber__value_[^"]*">([0-9][0-9,]*\.[0-9]+)<\/span>/,
    ) ||
    priceBoardSection.match(/([0-9][0-9,]*\.[0-9]+)\s*USD/) ||
    html.match(/([0-9][0-9,]*\.[0-9]+)\s*USD/);

  if (!priceMatch) {
    console.error("Yahoo S&P 500 parse failed", {
      sourceUrl,
      titleSnippet:
        html.match(/<title[^>]*>[\s\S]{0,160}<\/title>/i)?.[0] ?? null,
      sectionSnippet: priceBoardSection.slice(0, 800),
    });
    throw new Error("Unable to parse Yahoo S&P 500 HTML");
  }

  return {
    tradeDate: inferTradeDate(fetchedAt),
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
