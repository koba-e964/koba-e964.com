import type { ScheduledHandler } from "aws-lambda";

import { getConfig } from "../config.js";
import { upsertFundNav } from "../db.js";
import { fetchEmaxisFundNav } from "../sources/emaxis.js";

export const handler: ScheduledHandler = async () => {
  const config = getConfig();
  const nav = await fetchEmaxisFundNav(config.fundSourceUrl, config.fundCode);
  await upsertFundNav(config.databaseUrl, nav);
};
