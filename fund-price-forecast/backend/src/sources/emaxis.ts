import type { FundNavDailyRecord } from "../types.js";

const SOURCE_NAME = "eMAXIS";

interface FundDetailsResponse {
  datasets?: {
    cfm_base_date?: string | number | null;
    cfm_base_price?: string | number | null;
  } | null;
}

function parseNav(raw: string | number): number {
  return Number(String(raw).replace(/,/g, ""));
}

function parseBusinessDate(raw: string | number): string {
  const text = String(raw);
  const match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid fund base date: ${text}`);
  }
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

export function parseEmaxisFundJson(
  payload: string,
  fundCode: string,
  sourceUrl: string,
  fetchedAt: string,
): FundNavDailyRecord {
  let parsed: FundDetailsResponse;
  try {
    parsed = JSON.parse(payload) as FundDetailsResponse;
  } catch (error) {
    throw new Error(
      `Unable to parse fund NAV JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const businessDateRaw = parsed.datasets?.cfm_base_date;
  const navRaw = parsed.datasets?.cfm_base_price;
  if (businessDateRaw == null || navRaw == null) {
    console.error("Fund NAV JSON missing required fields", {
      sourceUrl,
      payloadSnippet: payload.slice(0, 400),
    });
    throw new Error("Fund NAV JSON does not contain base date and price");
  }

  return {
    fundCode,
    businessDate: parseBusinessDate(businessDateRaw),
    nav: parseNav(navRaw),
    sourceName: SOURCE_NAME,
    sourceUrl,
    fetchedAt,
    rawPayload: payload,
  };
}

export async function fetchEmaxisFundNav(
  sourceUrl: string,
  fundCode: string,
): Promise<FundNavDailyRecord> {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "fund-price-forecast/0.1",
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Fund source request failed with ${response.status}`);
  }
  const payload = await response.text();
  return parseEmaxisFundJson(
    payload,
    fundCode,
    sourceUrl,
    new Date().toISOString(),
  );
}
