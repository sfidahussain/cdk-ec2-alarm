import logging
from actions import check_alarm_tag, process_alarm_tags, delete_alarms, process_lambda_alarms, scan_and_process_alarm_tags
from os import getenv

logger = logging.getLogger()

create_alarm_tag = getenv("ALARM_TAG", "Create_Auto_Alarms")

cw_namespace = getenv("CLOUDWATCH_NAMESPACE", "CWAgent")

create_default_alarms_flag = getenv("CREATE_DEFAULT_ALARMS", "true").lower()

append_dimensions = getenv("CLOUDWATCH_APPEND_DIMENSIONS", 'InstanceId, ImageId, InstanceType')
append_dimensions = [dimension.strip() for dimension in append_dimensions.split(',')]

sns_topic_arn = getenv("DEFAULT_ALARM_SNS_TOPIC_ARN", None)

alarm_separator = '-'
alarm_identifier = 'AutoAlarm'
default_alarms = {
    # default<number> added to the end of the key to  make the key unique
    # this differentiate alarms with similar settings but different thresholds
    'AWS/EC2': [
        {
             'Key': alarm_separator.join(
                 [alarm_identifier, 'AWS/EC2', 'StatusCheckFailed_System', 'GreaterThanThreshold', '1m', 'Average', 'default1']),
             'Value': 1,
             'Alarm': 'arn:aws:swf:us-west-2:{CUSTOMER_ACCOUNT}:action/actions/AWS_EC2.InstanceId.Reboot/1.0''
        }
    ]
}

metric_dimensions_map = {
    cw_namespace: append_dimensions,
    'AWS/EC2': ['InstanceId']
}


def lambda_handler(event, context):
    logger.info('event received: {}'.format(event))
    try:
        if 'source' in event and event['source'] == 'aws.ec2' and event['detail']['state'] == 'running':
            instance_id = event['detail']['instance-id']
            # determine if instance is tagged to create an alarm
            instance_info = check_alarm_tag(instance_id, create_alarm_tag)

            # instance has been tagged for alarming, confirm an alarm doesn't already exist
            if instance_info:
                process_alarm_tags(instance_id, instance_info, default_alarms, metric_dimensions_map, sns_topic_arn,
                                   cw_namespace, create_default_alarms_flag, alarm_separator, alarm_identifier)
        elif 'source' in event and event['source'] == 'aws.ec2' and event['detail']['state'] == 'terminated':
            instance_id = event['detail']['instance-id']
            result = delete_alarms(instance_id, alarm_identifier, alarm_separator)
        elif  'action' in event and event['action'] == 'scan':
            logger.debug(
                f'Scanning for EC2 instances with tag: {create_alarm_tag} to create alarm'
            )
            scan_and_process_alarm_tags(create_alarm_tag, default_alarms, metric_dimensions_map, sns_topic_arn,
                                   cw_namespace, create_default_alarms_flag, alarm_separator, alarm_identifier)

    except Exception as e:
        # If any other exceptions which we didn't expect are raised
        # then fail the job and log the exception message.
        logger.error('Failure creating alarm: {}'.format(e))
        raise
