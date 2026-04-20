import type { Handler } from "aws-lambda";

import { getConfig } from "../config.js";
import {
  runIngestFundNav,
  runIngestMarketData,
  runRecomputePredictions,
} from "../jobs.js";

type JobName = "ingest_market" | "ingest_fund_nav" | "recompute_predictions";

interface JobEvent {
  job?: JobName;
}

export const handler: Handler<JobEvent, void> = async (event) => {
  const config = await getConfig();

  switch (event.job) {
    case "ingest_market":
      await runIngestMarketData(config);
      return;
    case "ingest_fund_nav":
      await runIngestFundNav(config);
      return;
    case "recompute_predictions":
      await runRecomputePredictions(config);
      return;
    default:
      throw new Error(`Unknown job: ${String(event.job)}`);
  }
};
