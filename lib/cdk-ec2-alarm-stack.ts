import { Stack, StackProps, aws_sns_subscriptions, CfnParameter, aws_sns, aws_lambda, aws_events,
  aws_events_targets, aws_iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from "path";

export class CdkEc2AlarmStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const myTopic = new aws_sns.Topic(this, 'ec2-alarms');

    myTopic.addSubscription(new aws_sns_subscriptions.EmailSubscription('sanfidahussain@gmail.com'));

    const myRole = new aws_iam.Role(this, 'My Role', {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    myRole.attachInlinePolicy( new aws_iam.Policy(this, 'LambdaPermissions', {
      policyName: 'LambdaPermissions',
      statements: [
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: ['cloudwatch:PutMetricData'],
          resources: ['*']
        }),
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: ["logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
            "logs:DescribeLogGroups"],
          resources: [`arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:*`]
        }),
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: ["logs:PutLogEvents"],
          resources: [`arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:*:log-stream:*`]
        }),
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: ["ec2:DescribeInstances",
            "ec2:DescribeImages"],
          resources: ['*']
        }),
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: ["ec2:CreateTags"],
          resources: [`arn:aws:ec2:${Stack.of(this).region}:${Stack.of(this).account}:instance/*`]
        }),
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: ["cloudwatch:DescribeAlarms",
            "cloudwatch:DeleteAlarms",
            "cloudwatch:PutMetricAlarm"],
          resources: [`arn:aws:cloudwatch:${Stack.of(this).region}:${Stack.of(this).account}:alarm:AutoAlarm-*`]
        }),
        new aws_iam.PolicyStatement({
          effect: aws_iam.Effect.ALLOW,
          actions: ["cloudwatch:DescribeAlarms"],
          resources: ['*']
        }),
      ]
    }))

    const fn = new aws_lambda.Function(this, 'LambdaFunction', {
      runtime: aws_lambda.Runtime.PYTHON_3_8,
      handler: 'cw_auto_alarms.lambda_handler',
      role: myRole,
      code: aws_lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      environment: {
        "ALARM_CPU_CREDIT_BALANCE_LOW_THRESHOLD": "100",
        "ALARM_CPU_HIGH_THRESHOLD": "75",
        "ALARM_DISK_PERCENT_LOW_THRESHOLD": "20",
        "ALARM_LAMBDA_ERROR_THRESHOLD": "0",
        "ALARM_LAMBDA_THROTTLE_THRESHOLD": "0",
        "ALARM_MEMORY_HIGH_THRESHOLD": "75",
        "ALARM_TAG": "Create_Auto_Alarms",
        "CLOUDWATCH_APPEND_DIMENSIONS": "InstanceId, ImageId, InstanceType",
        "CLOUDWATCH_NAMESPACE": "CWAgent",
        "CREATE_DEFAULT_ALARMS": 'true',
        "DEFAULT_ALARM_SNS_TOPIC_ARN": myTopic.topicArn
       }
    });

    const ec2Rule = new aws_events.Rule(this, 'ec2Rule', {
      eventPattern: {
        source: ["aws.ec2"],
        detailType: ["EC2 Instance State-change Notification"],
        detail: {
          "state": [
            "running",
            "terminated"
          ]
        }
      },
    });

    const lambdaRule = new aws_events.Rule(this, 'lambdaRule', {
      eventPattern: {
          "source": [
          "aws.lambda"
        ],
            detailType: [
          "AWS API Call via CloudTrail"
        ],
            detail: {
          "eventSource": [
            "lambda.amazonaws.com"
          ],
              eventName: [
            "TagResource20170331v2",
            "DeleteFunction20150331"
          ]
        }
      }
    });


    ec2Rule.addTarget(new aws_events_targets.LambdaFunction(fn));
    lambdaRule.addTarget(new aws_events_targets.LambdaFunction(fn))
  }
}
