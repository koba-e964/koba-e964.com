import process from "node:process";

import { getPublicLatestPayload } from "../src/db.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const fundCode = process.argv[2] ?? process.env.FUND_CODE ?? "253266";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const payload = await getPublicLatestPayload(databaseUrl, fundCode);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
