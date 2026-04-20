import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export interface AppConfig {
  databaseUrl: string;
  sp500SourceUrl: string;
  mufgFxUrl: string;
  fundSourceUrl: string;
  fundCode: string;
}

function getRequiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function getDatabaseUrl(): Promise<string> {
  const direct = process.env.DATABASE_URL;
  if (direct) {
    return direct;
  }

  const secretId = process.env.DATABASE_URL_SECRET_ID;
  if (!secretId) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_SECRET_ID");
  }

  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );
  const secretString = response.SecretString;
  if (!secretString) {
    throw new Error(`Secret ${secretId} does not contain SecretString`);
  }

  try {
    const parsed = JSON.parse(secretString) as {
      databaseUrl?: string;
      DATABASE_URL?: string;
    };
    const databaseUrl = parsed.databaseUrl || parsed.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("databaseUrl key missing");
    }
    return databaseUrl;
  } catch {
    return secretString;
  }
}

export async function getConfig(): Promise<AppConfig> {
  return {
    databaseUrl: await getDatabaseUrl(),
    sp500SourceUrl: getRequiredEnv(
      "SP500_SOURCE_URL",
      "https://finance.yahoo.co.jp/quote/%5EGSPC",
    ),
    mufgFxUrl: getRequiredEnv(
      "MUFG_FX_SOURCE_URL",
      "https://www.murc-kawasesouba.jp/fx/index.php",
    ),
    fundSourceUrl: getRequiredEnv(
      "FUND_SOURCE_URL",
      "https://emaxis.am.mufg.jp/fund/253266.html",
    ),
    fundCode: getRequiredEnv("FUND_CODE", "253266"),
  };
}
