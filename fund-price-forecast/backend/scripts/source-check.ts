import { fetchEmaxisFundNav } from "../src/sources/emaxis.js";
import { fetchMufgFx } from "../src/sources/mufg.js";
import { fetchGoogleSp500 } from "../src/sources/google.js";

const DEFAULTS = {
  fundCode: "253266",
  fundUrl: "https://www.am.mufg.jp/mukamapi/fund_details/?fund_cd=253266",
  fxUrl: "https://www.murc-kawasesouba.jp/fx/index.php",
  sp500Url: "https://www.google.com/finance/quote/.INX:INDEXSP?hl=en",
  sp500Symbol: "^GSPC",
} as const;

type SourceKind = "fund" | "fx" | "sp500";

function usage(): never {
  console.error(
    [
      "Usage:",
      "  npm run source:check -- fund",
      "  npm run source:check -- fx",
      "  npm run source:check -- sp500",
      "",
      "Optional environment variables:",
      "  FUND_CODE",
      "  FUND_SOURCE_URL",
      "  MUFG_FX_SOURCE_URL",
      "  SP500_SOURCE_URL",
      "  SP500_SYMBOL",
    ].join("\n"),
  );
  process.exit(1);
}

function requireKind(raw: string | undefined): SourceKind {
  if (raw === "fund" || raw === "fx" || raw === "sp500") {
    return raw;
  }
  usage();
}

async function main(): Promise<void> {
  const kind = requireKind(process.argv[2]);

  switch (kind) {
    case "fund": {
      const fundCode = process.env.FUND_CODE ?? DEFAULTS.fundCode;
      const sourceUrl = process.env.FUND_SOURCE_URL ?? DEFAULTS.fundUrl;
      const record = await fetchEmaxisFundNav(sourceUrl, fundCode);
      console.log(JSON.stringify(record, null, 2));
      return;
    }
    case "fx": {
      const sourceUrl = process.env.MUFG_FX_SOURCE_URL ?? DEFAULTS.fxUrl;
      const record = await fetchMufgFx(sourceUrl);
      console.log(JSON.stringify(record, null, 2));
      return;
    }
    case "sp500": {
      const sourceUrl = process.env.SP500_SOURCE_URL ?? DEFAULTS.sp500Url;
      const symbol = process.env.SP500_SYMBOL ?? DEFAULTS.sp500Symbol;
      const record = await fetchGoogleSp500(sourceUrl, symbol);
      console.log(JSON.stringify(record, null, 2));
      return;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
