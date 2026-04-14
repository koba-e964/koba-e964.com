import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, "../../backend/src/schema.sql");
const schema = await readFile(schemaPath, "utf8");
const sql = neon(databaseUrl);

for (const statement of schema
  .split(/;\s*\n/g)
  .map((part) => part.trim())
  .filter(Boolean)) {
  await sql.query(statement);
}

console.log(`Applied schema from ${schemaPath}`);
