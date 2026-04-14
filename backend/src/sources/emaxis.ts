import type { FundNavDailyRecord } from "../types.js";

const SOURCE_NAME = "eMAXIS";

function parseNav(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

export function parseEmaxisFundHtml(
  html: string,
  fundCode: string,
  sourceUrl: string,
  fetchedAt: string
): FundNavDailyRecord {
  const dateMatch =
    html.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})日/) ||
    html.match(/基準日[^0-9]*(\d{4})-(\d{2})-(\d{2})/);
  const navMatch =
    html.match(/基準価額[^0-9]{0,30}([0-9][0-9,]*)円/) ||
    html.match(/([0-9][0-9,]*)\s*円[\s\S]{0,60}?基準価額/);

  if (!dateMatch || !navMatch) {
    throw new Error("Unable to parse fund NAV HTML");
  }

  const [, year, month, day] = dateMatch;
  return {
    fundCode,
    businessDate: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    nav: parseNav(navMatch[1]),
    sourceName: SOURCE_NAME,
    sourceUrl,
    fetchedAt,
    rawPayload: html,
  };
}

export async function fetchEmaxisFundNav(sourceUrl: string, fundCode: string): Promise<FundNavDailyRecord> {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "fund-price-forecast/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`Fund source request failed with ${response.status}`);
  }
  const html = await response.text();
  return parseEmaxisFundHtml(html, fundCode, sourceUrl, new Date().toISOString());
}
