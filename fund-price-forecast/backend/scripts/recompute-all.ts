import { getConfig } from "../src/config.js";
import { runRecomputeAllPredictions } from "../src/jobs.js";

async function main(): Promise<void> {
  const config = await getConfig();
  const recomputed = await runRecomputeAllPredictions(config);
  console.log(JSON.stringify({ fundCode: config.fundCode, recomputed }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
