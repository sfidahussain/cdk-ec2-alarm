#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkEc2AlarmStack } from '../lib/cdk-ec2-alarm-stack';

const app = new cdk.App();
new CdkEc2AlarmStack(app, 'CdkEc2AlarmStack');
