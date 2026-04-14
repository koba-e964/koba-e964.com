import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

import { getConfig } from "../config.js";
import { getPublicLatestPayload } from "../db.js";

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const config = getConfig();
  const fundCode = event.pathParameters?.code || config.fundCode;
  const payload = await getPublicLatestPayload(config.databaseUrl, fundCode);

  if (!payload) {
    return {
      statusCode: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "fund_not_found", fundCode }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(payload),
  };
}
