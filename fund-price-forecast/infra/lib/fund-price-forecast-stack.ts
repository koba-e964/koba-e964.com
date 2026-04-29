import * as path from "node:path";
import { fileURLToPath } from "node:url";

import * as cdk from "aws-cdk-lib";
import { aws_apigatewayv2 as apigwv2 } from "aws-cdk-lib";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as schedulerTargets from "aws-cdk-lib/aws-scheduler-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { TimeZone } from "aws-cdk-lib";
import { Construct } from "constructs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export interface FundPriceForecastStackProps extends cdk.StackProps {
  secretId: string;
  fundCode: string;
  fundSourceUrl: string;
  sp500SourceUrl: string;
  sp500Symbol: string;
  mufgFxSourceUrl: string;
}

export class FundPriceForecastStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: FundPriceForecastStackProps,
  ) {
    super(scope, id, props);

    const databaseSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "DatabaseSecret",
      props.secretId,
    );
    const schedulerRole = new iam.Role(this, "SchedulerInvokeRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });

    const commonEnvironment = {
      DATABASE_URL_SECRET_ID: props.secretId,
      FUND_CODE: props.fundCode,
      FUND_SOURCE_URL: props.fundSourceUrl,
      SP500_SOURCE_URL: props.sp500SourceUrl,
      SP500_SYMBOL: props.sp500Symbol,
      MUFG_FX_SOURCE_URL: props.mufgFxSourceUrl,
      NODE_OPTIONS: "--enable-source-maps",
    };

    const runJob = this.createNodeFunction(
      "RunJob",
      "runJob.ts",
      commonEnvironment,
    );
    const readPublicData = this.createNodeFunction(
      "ReadPublicData",
      "readPublicData.ts",
      commonEnvironment,
    );

    databaseSecret.grantRead(runJob);
    databaseSecret.grantRead(readPublicData);

    runJob.grantInvoke(schedulerRole);

    const httpApi = new apigwv2.HttpApi(this, "PublicApi", {
      apiName: "fund-price-forecast-public-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["content-type"],
        allowMethods: [apigwv2.CorsHttpMethod.GET],
      },
    });

    httpApi.addRoutes({
      path: "/api/funds/{code}/latest",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "ReadLatestIntegration",
        readPublicData,
      ),
    });

    this.createSchedule(
      "FundNavHalfHourly",
      "cron(0/30 * * * ? *)",
      runJob,
      schedulerRole,
      "ingest_fund_nav",
    );
    this.createSchedule(
      "MarketHalfHourly",
      "cron(5/30 * * * ? *)",
      runJob,
      schedulerRole,
      "ingest_market",
    );
    this.createSchedule(
      "RecomputeHalfHourly",
      "cron(10/30 * * * ? *)",
      runJob,
      schedulerRole,
      "recompute_predictions",
    );

    new cdk.CfnOutput(this, "PublicApiUrl", {
      value: httpApi.url ?? "",
    });
    new cdk.CfnOutput(this, "DatabaseSecretId", {
      value: props.secretId,
    });
  }

  private createNodeFunction(
    name: string,
    entryFile: string,
    environment: Record<string, string>,
  ): NodejsFunction {
    const logGroup = new logs.LogGroup(this, `${name}LogGroup`, {
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const fn = new NodejsFunction(this, name, {
      entry: path.join(moduleDir, "../../backend/src/handlers", entryFile),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment,
      bundling: {
        format: OutputFormat.ESM,
        target: "node22",
        sourceMap: true,
      },
      logGroup,
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: ["*"],
      }),
    );

    return fn;
  }

  private createSchedule(
    id: string,
    scheduleExpression: string,
    target: lambda.IFunction,
    role: iam.IRole,
    job: string,
  ): scheduler.Schedule {
    return new scheduler.Schedule(this, id, {
      schedule: scheduler.ScheduleExpression.expression(
        scheduleExpression,
        TimeZone.ASIA_TOKYO,
      ),
      target: new schedulerTargets.LambdaInvoke(target, {
        input: scheduler.ScheduleTargetInput.fromObject({ job }),
        role,
      }),
      description: `${id} for fund price forecast`,
    });
  }
}
