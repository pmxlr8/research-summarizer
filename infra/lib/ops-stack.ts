import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSub from "aws-cdk-lib/aws-sns-subscriptions";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";

interface OpsStackProps extends cdk.StackProps {
  alertEmail: string;
  monthlyBudgetUsd: number;
  jobsQueue: sqs.Queue;
  deadLetterQueue: sqs.Queue;
  stateMachine: sfn.StateMachine;
  apiName: string;          // for API Gateway metrics
  pipelineFns: lambda.IFunction[];
  apiFns: lambda.IFunction[];
}

/**
 * Operational excellence layer.
 *
 *   - SNS topic with email subscription (you confirm via email after deploy).
 *   - AWS Budgets alarm at the configured monthly USD ceiling.
 *   - CloudWatch alarms on:
 *       - DLQ depth > 0
 *       - any Lambda error rate spike
 *       - Step Functions execution failures
 *       - API Gateway 5xx rate
 *   - One CloudWatch dashboard aggregating the above.
 */
export class OpsStack extends cdk.Stack {
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: OpsStackProps) {
    super(scope, id, props);

    // ─── SNS alert topic ───────────────────────────────────────────

    this.alertTopic = new sns.Topic(this, "AlertTopic", {
      displayName: "Summarizer alerts",
    });
    this.alertTopic.addSubscription(new snsSub.EmailSubscription(props.alertEmail));

    // ─── AWS Budgets ───────────────────────────────────────────────

    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: "USD" },
        budgetName: "Summarizer-Monthly",
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: "ACTUAL",
            threshold: 80,
            thresholdType: "PERCENTAGE",
            comparisonOperator: "GREATER_THAN",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail }],
        },
        {
          notification: {
            notificationType: "FORECASTED",
            threshold: 100,
            thresholdType: "PERCENTAGE",
            comparisonOperator: "GREATER_THAN",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail }],
        },
      ],
    });

    // ─── Alarms ────────────────────────────────────────────────────

    const dlqAlarm = new cloudwatch.Alarm(this, "DLQDepthAlarm", {
      alarmName: "Summarizer-DLQ-Has-Messages",
      alarmDescription: "A summarization job has failed 3+ times and landed in the DLQ.",
      metric: props.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(1),
        statistic: "Maximum",
      }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dlqAlarm.addAlarmAction(new cwActions.SnsAction(this.alertTopic));

    const sfnFailAlarm = new cloudwatch.Alarm(this, "StateMachineFailures", {
      alarmName: "Summarizer-StepFunctions-Failures",
      alarmDescription: "Summarization state machine has failed executions.",
      metric: props.stateMachine.metricFailed({
        period: cdk.Duration.minutes(5),
        statistic: "Sum",
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    sfnFailAlarm.addAlarmAction(new cwActions.SnsAction(this.alertTopic));

    // Two error alarms — pipeline + API — keeps each math expression
    // under the 10-metric limit and lets us distinguish failure surfaces.
    const buildErrorAlarm = (id: string, fns: lambda.IFunction[], threshold: number) => {
      const expr = new cloudwatch.MathExpression({
        expression: fns.map((_, i) => `e${i}`).join(" + "),
        usingMetrics: Object.fromEntries(
          fns.map((fn, i) => [
            `e${i}`,
            fn.metricErrors({ period: cdk.Duration.minutes(5), statistic: "Sum" }),
          ]),
        ),
        label: id,
        period: cdk.Duration.minutes(5),
      });
      const alarm = new cloudwatch.Alarm(this, id, {
        alarmName: `Summarizer-${id}`,
        alarmDescription: `${id}: Lambda errors above threshold (${threshold} in 5 min).`,
        metric: expr,
        threshold,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(new cwActions.SnsAction(this.alertTopic));
    };
    buildErrorAlarm("PipelineErrors", props.pipelineFns, 3);
    buildErrorAlarm("ApiErrors", props.apiFns, 5);

    // ─── Dashboard ─────────────────────────────────────────────────

    const dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: "Summarizer-Operations",
      defaultInterval: cdk.Duration.hours(6),
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Pipeline executions (last 6h)",
        width: 12,
        left: [
          props.stateMachine.metricStarted({ statistic: "Sum", period: cdk.Duration.minutes(5) }),
          props.stateMachine.metricSucceeded({ statistic: "Sum", period: cdk.Duration.minutes(5) }),
          props.stateMachine.metricFailed({ statistic: "Sum", period: cdk.Duration.minutes(5) }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: "Pipeline duration (P95)",
        width: 12,
        left: [props.stateMachine.metricTime({ statistic: "p95", period: cdk.Duration.minutes(5) })],
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "API Gateway requests + 5xx rate",
        width: 12,
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "Count",
            dimensionsMap: { ApiName: props.apiName, Stage: "v1" },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "5XXError",
            dimensionsMap: { ApiName: props.apiName, Stage: "v1" },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
          }),
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "4XXError",
            dimensionsMap: { ApiName: props.apiName, Stage: "v1" },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: "API latency (P95)",
        width: 12,
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "Latency",
            dimensionsMap: { ApiName: props.apiName, Stage: "v1" },
            statistic: "p95",
            period: cdk.Duration.minutes(5),
          }),
        ],
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "SQS — Jobs Queue & DLQ depth",
        width: 12,
        left: [
          props.jobsQueue.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(1) }),
        ],
        right: [
          props.deadLetterQueue.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(1) }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: "Pipeline Lambda errors (per fn)",
        width: 12,
        left: props.pipelineFns.map((fn) =>
          fn.metricErrors({ period: cdk.Duration.minutes(5), statistic: "Sum", label: fn.functionName }),
        ),
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "API Lambda invocations + errors",
        width: 24,
        left: props.apiFns.map((fn) =>
          fn.metricInvocations({ period: cdk.Duration.minutes(5), statistic: "Sum", label: fn.functionName }),
        ),
        right: props.apiFns.map((fn) =>
          fn.metricErrors({ period: cdk.Duration.minutes(5), statistic: "Sum", label: `${fn.functionName} errors` }),
        ),
      }),
    );

    new cdk.CfnOutput(this, "AlertTopicArn", { value: this.alertTopic.topicArn });
    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=Summarizer-Operations`,
    });
  }
}
