import jsonStringify from 'json-stringify-safe'
import Hook from 'require-in-the-middle'

import { patchModule, serializeError } from './utils'
import { debugLog } from '../log'
import { tracer } from '../tracer'
import { ResourceAccessEvent } from '../entities'
import { getSNSTrigger } from './sqs-sns-trigger.utils'

const SNSv3EventCreator = {
  requestHandler(operation, command, event: ResourceAccessEvent) {
    switch (operation) {
      case 'publish': {
        const paramArn = command.input.TopicArn || command.input.TargetArn;
        event.request.resourceIdentifier = {
          topicArn: `${paramArn.split(':').pop()}` || 'N/A'
        }
        event.request = {
          'Notification Message': `${command.input.Message}`,
          'Notification Message Attributes': `${JSON.stringify(command.input.MessageAttributes)}`,
        }
        break;
      }
      default:
        break;
    }
  },

  /**
   * Updates an event with the appropriate fields from a SNS response
   * @param {string} operation the operation we wrapped.
   * @param {object} response The AWS.Response object
   * @param {proto.event_pb.Event} event The event to update the data on
   */
  responseHandler(operation, response, event) {
    switch (operation) {
      case 'publish':
        event.response = {
          'MessageId': `${response.MessageId}`,
        }
        break;
      default:
        break;
    }
  },
};

const SQSv3EventCreator = {
  requestHandler(operation, command, event) {
    const parameters = command.input || {};

    if ('QueueUrl' in parameters) {
      if (parameters.QueueUrl.split('/') != null &&
        parameters.QueueUrl.split('/') !== '') {
        event.resourceIdentifier = {
          queueName: `${parameters.QueueUrl.split('/').pop()}`,
        }
      }
    }

    const entry = 'Entries' in parameters ? parameters.Entries : parameters

    if ('MessageBody' in entry) {
      event.request.messageBody = entry.MessageBody
    }
    if ('MessageAttributes' in entry) {
      event.request.messageAttributes = entry.MessageAttributes
    }
  },

  responseHandler(operation, response, event) {
    switch (operation) {
      case 'SendMessageCommand':
        event.response.messageId = response.data.MessageId
        event.response.bodyMd5 = response.data.MD5OfMessageBody
        break
      case 'ReceiveMessageCommand': {
        let messagesNumber = 0
        if ('Messages' in response.data && response.data.Messages.length > 0) {
          messagesNumber = response.data.Messages.length
          event.response.messageIds = response.data.Messages.map((x) => x.MessageId)
          event.response.snsTrigger = getSNSTrigger(response.data.Messages)
          event.response.messagesNumber = messagesNumber
        }
        break
      }
      default:
        break
    }
  },
};

const DynamoDBv3EventCreator = {
  /**
   * Updates an event with the appropriate fields from a dynamoDB command
   * @param {string} operation the operation we wrapped.
   * @param {Command} command the wrapped command
   * @param {proto.event_pb.Event} event The event to update the data on
   */
  requestHandler(operation, command, event) {
    const resource = event.getResource();
    const parameters = command.input || {};
    resource.setName(command.input.TableName || 'DynamoDBEngine');

    switch (operation) {
      case 'DeleteCommand':
      case 'DeleteItemCommand':
      case 'GetCommand':
      case 'GetItemCommand':
        event.request.key = parameters.Key
        break

      case 'PutCommand':
      case 'PutItemCommand':
        event.request.key = parameters.Key
        event.request.item = parameters.Item
        break;

      case 'UpdateCommand':
      case 'UpdateItemCommand':
        event.request.key = parameters.Key
        event.request.updateExpression = parameters.UpdateExpression
        event.request.expressionAttributeName = parameters.ExpressionAttributeNames
        event.request.expressionAttributeValues = parameters.ExpressionAttributeValues
        break;

      case 'ScanCommand':
      case 'QueryCommand': {
        event.request.keyConditions = parameters.KeyConditions
        event.request.queryFilter = parameters.QueryFilter
        event.request.exclusiveStartKey = parameters.ExclusiveStartKey
        event.request.projectionExpression = parameters.ProjectionExpression
        event.request.filterExpression = parameters.FilterExpression
        event.request.keyConditionExpression = parameters.KeyConditionExpression
        event.request.expressionAttributeValues = parameters.ExpressionAttributeValues
        break;
      }

      case 'BatchWriteItemCommand': {
        const tableNames = Object.keys(parameters.RequestItems)
        event.resourceIdentifier = {
          tableNames,
        }
        const addedItems: any[] = []
        const deletedKeys: any[] = []
        for (const tableName of tableNames) {
          parameters.RequestItems[tableName].forEach((item) => {
            if (item.PutRequest) {
              addedItems.push(item.PutRequest.Item)
            }
            if (item.DeleteRequest) {
              deletedKeys.push(item.DeleteRequest.Key)
            }
          })
        }
        if (addedItems.length !== 0) {
          event.request.addedItems = addedItems
        }
        if (deletedKeys.length !== 0) {
          event.request.deletedKeys = deletedKeys
        }
        break
      }

      default:
        break;
    }
  },

  /**
   * Updates an event with the appropriate fields from a DynamoDB response
   * @param {string} operation the operation we wrapped.
   * @param {object} response The AWS.Response object
   * @param {proto.event_pb.Event} event The event to update the data on
   */
  responseHandler(operation, response, event) {
    switch (operation) {
      case 'GetCommand':
      case 'GetItemCommand':
        event.response.item = response.data.Item
        break;

      case 'ListTablesCommand':
        event.response.tableNames = response.TableNames
        break;

      case 'ScanCommand':
      case 'QueryCommand': {
        event.response.items = response.data.Items
        event.response.lastEvaluatedKey = response.data.LastEvaluatedKey
        break;
      }

      default:
        break;
    }
  },
};

/**
 * a map between AWS resource names and their appropriate creator object.
 */
const specificEventCreators = {
  sns: SNSv3EventCreator,
  dynamodb: DynamoDBv3EventCreator,
  sqs: SQSv3EventCreator,
};

/**
 *
 * @param {Command} command the wrapped command
 * @returns {operation} operation name
 */
function getOperationByCommand(command) {
  const cmd = command.constructor.name;
  switch (cmd) {
    case 'PublishCommand':
      return 'publish';
    default:
      return cmd;
  }
}

/**
 * Wraps the @aws-sdk sns-client commands
 * @param {Function} wrappedFunction The function to wrap
 * @returns {Function} The wrapped function
 */
function AWSSDKv3Wrapper(wrappedFunction) {
  console.log('wrapping function', wrappedFunction)
  return function internalAWSSDKv3Wrapper(command) {
    console.log('wrapped command: ', command)
    let responsePromise = wrappedFunction.apply(this, [command]);
    try {
      console.log(this, this.config, this.config.serviceId)
      const serviceIdentifier = this.config.serviceId.toLowerCase();

      if (!serviceIdentifier) {
        // resource is not supported yet
        return responsePromise;
      }

      const operation = getOperationByCommand(command)
      const event = tracer.resourceAccessStart(serviceIdentifier, undefined, {
        request: {
          operation,
        },
      })

      console.log('recording event', event)

      specificEventCreators[serviceIdentifier].requestHandler(
        operation,
        command,
        event
      );
      responsePromise = responsePromise.then((response) => {
        try {
          event.end = Date.now()
          event.status = 'OK'
          event.request.requestId = response.requestId

          if (response.data) {
            event.response.statusCode = response.httpResponse.statusCode
            event.status = 'OK'

            specificEventCreators[serviceIdentifier].responseHandler(response, event)
          }

          if (response.error !== null) {
            event.error = jsonStringify(response.error)
            event.status = 'ERROR'
          }
        } catch (e) {
          debugLog(e)
        }
        return response;
      }).catch((error) => {
        try {
          event.end = Date.now()
          event.error = serializeError(error)
          event.status = 'ERROR'
        } catch (e) {
          debugLog(e)
        }
      });
    } catch (error) {
      debugLog(error)
    }
    return responsePromise;
  };
}

export default {
  /**
   * Initializes the @aws-sdk tracer
   */
  init() {
    Hook(
      ['@smithy/smithy-client'],
      (AWSmod) => {
        console.log('wrap using require-in-the-middle', Object.keys(AWSmod))
        AWSmod.Client.prototype.send = AWSSDKv3Wrapper(AWSmod.Client.prototype.send)
        return AWSmod
      },
    );

    patchModule(
      '@aws-sdk/client-dynamodb',
      'send',
      AWSSDKv3Wrapper,
      (AWSmod) => AWSmod.DynamoDBClient.prototype
    );
    patchModule(
      '@aws-sdk/client-sqs',
      'send',
      AWSSDKv3Wrapper,
      (AWSmod) => AWSmod.SQSClient.prototype
    );
    patchModule(
      '@aws-sdk/client-lambda',
      'send',
      AWSSDKv3Wrapper,
      (AWSmod) => {
        console.log('wrapping lambda client', Object.keys(AWSmod))
        return AWSmod.LambdaClient.prototype
      }
    );
    patchModule(
      '@aws-sdk/client-ses',
      'send',
      AWSSDKv3Wrapper,
      (AWSmod) => AWSmod.SESClient.prototype
    );
    patchModule(
      '@smithy/smithy-client',
      'send',
      AWSSDKv3Wrapper,
      (AWSmod) => {
        console.log('wrapping smithy client', Object.keys(AWSmod))
        return AWSmod.Client.prototype
      }
    );
  },
};
