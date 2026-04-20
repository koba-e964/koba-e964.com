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
    "https://emaxis.am.mufg.jp/fund/253266.html",
  sp500SourceUrl:
    app.node.tryGetContext("sp500SourceUrl") ??
    "https://finance.yahoo.co.jp/quote/%5EGSPC",
  mufgFxSourceUrl:
    app.node.tryGetContext("mufgFxSourceUrl") ??
    "https://www.murc-kawasesouba.jp/fx/index.php",
});
