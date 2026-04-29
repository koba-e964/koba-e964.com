import "source-map-support/register.js";
import * as cdk from "aws-cdk-lib";

import { FundPriceForecastStack } from "../lib/fund-price-forecast-stack.js";

const app = new cdk.App();

new FundPriceForecastStack(app, "FundPriceForecastStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
  },
  secretId:
    app.node.tryGetContext("databaseSecretId") ??
    "fund-price-forecast/prod/database-url",
  fundCode: app.node.tryGetContext("fundCode") ?? "253266",
  fundSourceUrl:
    app.node.tryGetContext("fundSourceUrl") ??
    "https://www.am.mufg.jp/mukamapi/fund_details/?fund_cd=253266",
  sp500SourceUrl:
    app.node.tryGetContext("sp500SourceUrl") ??
    "https://www.google.com/finance/quote/SP500TR:INDEXSP?hl=en",
  sp500Symbol: app.node.tryGetContext("sp500Symbol") ?? "^SP500TR",
  mufgFxSourceUrl:
    app.node.tryGetContext("mufgFxSourceUrl") ??
    "https://www.murc-kawasesouba.jp/fx/index.php",
});
