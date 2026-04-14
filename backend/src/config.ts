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

export function getConfig(): AppConfig {
  return {
    databaseUrl: getRequiredEnv("DATABASE_URL"),
    sp500SourceUrl: getRequiredEnv("SP500_SOURCE_URL", "https://finance.yahoo.co.jp/quote/%5EGSPC"),
    mufgFxUrl: getRequiredEnv("MUFG_FX_SOURCE_URL", "https://www.bk.mufg.jp/ippan/kinri/list_j/kinri/kawase.html"),
    fundSourceUrl: getRequiredEnv("FUND_SOURCE_URL", "https://emaxis.am.mufg.jp/fund/253266.html"),
    fundCode: getRequiredEnv("FUND_CODE", "253266"),
  };
}
