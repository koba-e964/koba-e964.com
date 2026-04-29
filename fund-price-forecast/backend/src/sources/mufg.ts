import type { FxDailyRecord } from "../types.js";

const SOURCE_NAME = "MUFG TTM";
const EN_MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function midpoint(tts: number, ttb: number): number {
  return Number(((tts + ttb) / 2).toFixed(6));
}

function extractUsdRow(html: string): string | null {
  return (
    html.match(
      /<tr>[\s\S]{0,400}?(?:US Dollar|米ドル)[\s\S]{0,200}?<td[^>]*>\s*USD\s*<\/td>[\s\S]{0,300}?<\/tr>/i,
    )?.[0] ?? null
  );
}

function extractUsdQuotes(
  usdRowHtml: string,
): { tts: string; ttb: string } | null {
  const quoteCells = [
    ...usdRowHtml.matchAll(
      /<td[^>]*class="t_right"[^>]*>\s*([^<]+?)\s*<\/td>/gi,
    ),
  ].map((match) => match[1].trim());
  if (quoteCells.length < 2) {
    return null;
  }
  return {
    tts: quoteCells[0],
    ttb: quoteCells[1],
  };
}

export function parseMufgFxHtml(
  html: string,
  sourceUrl: string,
  fetchedAt: string,
): FxDailyRecord {
  const numericDateMatch =
    html.match(/(\d{4})[/年](\d{1,2})[/月](\d{1,2})日/) ||
    html.match(/(\d{4})-(\d{2})-(\d{2})/);
  const englishDateMatch = html.match(
    /As of\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i,
  );
  const usdRowHtml = extractUsdRow(html);
  const usdQuotes = usdRowHtml ? extractUsdQuotes(usdRowHtml) : null;

  if ((!numericDateMatch && !englishDateMatch) || !usdQuotes) {
    throw new Error("Unable to parse MUFG FX HTML");
  }

  if (usdQuotes.tts === "-" || usdQuotes.ttb === "-") {
    throw new Error("MUFG FX quote not published yet");
  }

  const [year, month, day] = numericDateMatch
    ? [numericDateMatch[1], numericDateMatch[2], numericDateMatch[3]]
    : [
        englishDateMatch![3],
        EN_MONTHS[englishDateMatch![1].toLowerCase()],
        englishDateMatch![2].padStart(2, "0"),
      ];
  const tts = toNumber(usdQuotes.tts);
  const ttb = toNumber(usdQuotes.ttb);

  return {
    businessDate: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    currencyPair: "USD/JPY",
    tts,
    ttb,
    ttm: midpoint(tts, ttb),
    sourceName: SOURCE_NAME,
    sourceUrl,
    fetchedAt,
    rawPayload: html,
  };
}

export async function fetchMufgFx(sourceUrl: string): Promise<FxDailyRecord> {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "fund-price-forecast/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`MUFG source request failed with ${response.status}`);
  }
  const html = await response.text();
  return parseMufgFxHtml(html, sourceUrl, new Date().toISOString());
}
