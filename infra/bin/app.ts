#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { FrontendStack } from "../lib/frontend-stack";
import { AuthStack } from "../lib/auth-stack";
import { DataStack } from "../lib/data-stack";
import { ApiStack } from "../lib/api-stack";
import { PipelineStack } from "../lib/pipeline-stack";
import { OpsStack } from "../lib/ops-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
};

// Namespace every stack so multiple environments (dev/prod) can coexist.
const stage = app.node.tryGetContext("stage") ?? "dev";
const prefix = `Summarizer-${stage}`;

const auth = new AuthStack(app, `${prefix}-Auth`, { env });
const data = new DataStack(app, `${prefix}-Data`, { env });
const pipeline = new PipelineStack(app, `${prefix}-Pipeline`, {
  env,
  table: data.table,
  pdfBucket: data.pdfBucket,
});
const api = new ApiStack(app, `${prefix}-Api`, {
  env,
  userPool: auth.userPool,
  table: data.table,
  jobsQueue: pipeline.jobsQueue,
});
const frontend = new FrontendStack(app, `${prefix}-Frontend`, {
  env,
  apiEndpoint: api.apiEndpoint,
  userPoolId: auth.userPool.userPoolId,
  userPoolClientId: auth.userPoolClient.userPoolClientId,
});

new OpsStack(app, `${prefix}-Ops`, {
  env,
  alertEmail: app.node.tryGetContext("alertEmail") ?? "pranjalm74@gmail.com",
  monthlyBudgetUsd: 50,
  jobsQueue: pipeline.jobsQueue,
  deadLetterQueue: pipeline.deadLetterQueue,
  stateMachine: pipeline.stateMachine,
  apiName: api.apiName,
  pipelineFns: pipeline.pipelineFns,
  apiFns: api.handlerFns,
});

cdk.Tags.of(app).add("Project", "research-summarizer");
cdk.Tags.of(app).add("Stage", stage);
