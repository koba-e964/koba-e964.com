import type { APIGatewayProxyResultV2, ScheduledHandler } from "aws-lambda";

import { getConfig } from "../config.js";
import { upsertFx, upsertMarketIndex } from "../db.js";
import { fetchMufgFx } from "../sources/mufg.js";
import { fetchYahooSp500 } from "../sources/yahoo.js";

export const handler: ScheduledHandler = async () => {
  const config = getConfig();
  const [sp500, fx] = await Promise.all([
    fetchYahooSp500(config.sp500SourceUrl),
    fetchMufgFx(config.mufgFxUrl),
  ]);

  await Promise.all([
    upsertMarketIndex(config.databaseUrl, sp500),
    upsertFx(config.databaseUrl, fx),
  ]);
};

export function ok(body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}
