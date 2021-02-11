import jsonStringify from 'json-stringify-safe'

import { patchModule, serializeError } from './utils'
import { getSNSTrigger } from './sqs-sns-trigger.utils'
import { debugLog } from '../log'
import { tracer } from '../tracer'
import { safeParse } from '../utils';

const s3EventCreator = {
  requestHandler(request: any, event: any) {
    const parameters = request.params || {}
    const { operation } = request

    event.resourceIdentifier = {
      bucketName: parameters.Bucket,
    }

    switch (operation) {
      case 'headObject':
      // fall through
      case 'getObject':
      // fall through
      case 'putObject':
        event.request = {
          key: parameters.Key,
          bucketName: parameters.Bucket,
        }
        event.resourceIdentifier = {
          bucketName: parameters.Bucket,
          key: parameters.Key,
        }
        break
      default:
        break
    }
  },

  responseHandler(response: any, event: any) {
    switch (response.request.operation) {
      case 'listObjects':
        event.response.files = response.data.Contents.map((entry: any) => ({
          key: `${entry.Key}`,
          size: entry.Size,
          etag: entry.Etag,
        }))
        break

      case 'putObject':
        event.response.etag = response.data.ETag.replace(/"/g, '')
        break

      case 'headObject':
      // fall through
      case 'getObject':
        event.response.fileSize = response.data.ContentLength
        event.response.etag = response.data.ETag.replace(/"/g, '')
        event.response = response.data.LastModified
        break
      default:
        break
    }
  },
}

const kinesisEventCreator = {
  /**
   * Updates an event with the appropriate fields from a Kinesis request
   * @param {object} request The AWS.Request object
   * @param {proto.event_pb.Event} event The event to update the data on
   */
  requestHandler(request, event) {
    const parameters = request.params || {}
    event.resourceIdentifier = {
      streamName: parameters.StreamName,
      paritionKey: parameters.PartitionKey,
    }
    event.request.data = parameters.Data
  },

  /**
   * Updates an event with the appropriate fields from a Kinesis response
   * @param {object} response The AWS.Response object
   * @param {proto.event_pb.Event} event The event to update the data on
   */
  responseHandler(response, event) {
    switch (response.request.operation) {
      case 'putRecord':
        event.response.shardId = response.data.ShardId
        event.response.sequenceNumber = response.data.SequenceNumber
        break
      default:
        break
    }
  },
}

const SNSEventCreator = {
  requestHandler(request, event) {
    const parameters = request.params || {}
    const resourceArn = parameters.TopicArn || parameters.TargetArn
    event.resourceIdentifier = {
      resourceArn,
    }
    event.request.message = parameters.Message
  },

  responseHandler(response, event) {
    switch (response.request.operation) {
      case 'publish':
        event.response.messageId = response.data.MessageId
        break
      default:
        break
    }
  },
}

const SQSEventCreator = {
  requestHandler(request, event) {
    const parameters = request.params || {}

    let queueName

    if ('QueueUrl' in parameters) {
      queueName = parameters.QueueUrl.split('/').pop()
    }
    if ('QueueName' in parameters) {
      queueName = parameters.QueueName
    }

    event.resourceIdentifier = {
      queueName,
    }

    const entry = 'Entries' in parameters ? parameters.Entries : parameters

    if ('MessageBody' in entry) {
      event.request.messageBody = entry.MessageBody
    }
    if ('MessageAttributes' in entry) {
      event.request.messageAttributes = entry.MessageAttributes
    }
  },

  responseHandler(response, event) {
    switch (response.request.operation) {
      case 'sendMessage':
        event.response.messageId = response.data.MessageId
        event.response.bodyMd5 = response.data.MD5OfMessageBody
        break
      case 'receiveMessage': {
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
}

const SESEventCreator = {
  requestHandler(request, event) {
    const parameters = request.params || {}
    switch (request.operation) {
      case 'sendEmail':
        event.request.source = parameters.Source
        event.request.destination = parameters.Destination.ToAddresses
        event.request.subject = parameters.Message.Subject.Data
        event.request.messageText = parameters.Message.Body.Text.Data
        event.request.messageHtml = parameters.Message.Body.Html.Data
        break
      default:
        break
    }
  },

  responseHandler(response, event) {
    switch (response.request.operation) {
      case 'sendEmail':
        event.response.messageId = response.data.MessageId
        break
      default:
        break
    }
  },
}

const lambdaEventCreator = {
  requestHandler(request, event) {
    const parameters = request.params || {}

    event.resourceIdentifier = {
      functionName: parameters.FunctionName,
    }
    event.request.payload = parameters.Payload
  },

  responseHandler(response, event) {
    event.response.payload = safeParse(response?.Payload) || response?.Payload?.toString()
  },
}

const dynamoDBEventCreator = {
  requestHandler(request, event) {
    const parameters = request.params || {}
    const { operation } = request

    event.resourceIdentifier = {
      tableName: parameters.TableName,
    }

    switch (operation) {
      case 'deleteItem':
      case 'getItem':
        event.request.key = parameters.Key
        break

      case 'putItem':
        event.request.key = parameters.Key
        event.request.item = parameters.Item
        break

      case 'updateItem':
        event.request.key = parameters.Key
        event.request.updateExpression = parameters.UpdateExpression
        event.request.expressionAttributeName = parameters.ExpressionAttributeNames
        event.request.expressionAttributeValues = parameters.ExpressionAttributeValues
        break

      case 'query': {
        event.request.keyConditions = parameters.KeyConditions
        event.request.queryFilter = parameters.QueryFilter
        event.request.exclusiveStartKey = parameters.ExclusiveStartKey
        event.request.projectionExpression = parameters.ProjectionExpression
        event.request.filterExpression = parameters.FilterExpression
        event.request.keyConditionExpression = parameters.KeyConditionExpression
        event.request.expressionAttributeValues = parameters.ExpressionAttributeValues
        break
      }

      case 'scan': {
        event.request.keyConditions = parameters.ScanFilter
        event.request.exclusiveStartKey = parameters.ExclusiveStartKey
        event.request.projectionExpression = parameters.ProjectionExpression
        event.request.filterExpression = parameters.FilterExpression
        event.request.expressionAttributeValues = parameters.ExpressionAttributeValues
        break
      }

      case 'batchWriteItem': {
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
        break
    }
  },

  responseHandler(response, event) {
    switch (response.request.operation) {
      case 'getItem':
        event.response.item = response.data.Item
        break

      case 'listTables':
        event.response.tableNames = response.data.TableNames
        break

      case 'scan':
      case 'query': {
        event.response.items = response.data.Items
        event.response.lastEvaluatedKey = response.data.LastEvaluatedKey
        break
      }

      default:
        break
    }
  },
}

const athenaEventCreator = {
  requestHandler(request, event) {
    const parameters = request.params || {}
    switch (request.operation) {
      case 'startQueryExecution':
        if (
          'QueryExecutionContext' in parameters &&
          'Database' in parameters.QueryExecutionContext
        ) {
          event.resourceIdentifier = {
            database: parameters.QueryExecutionContext.Database,
          }
        }

        event.request.query = parameters.QueryString
        break
      case 'getQueryExecution':
      case 'getQueryResults':
      case 'stopQueryExecution':
        event.request.queryExecutionId = parameters.QueryExecutionId
        break
      default:
        break
    }
  },

  responseHandler(response, event) {
    switch (response.request.operation) {
      case 'getQueryExecution':
        if (
          'Status' in response.data.QueryExecution &&
          'State' in response.data.QueryExecution.Status
        ) {
          event.response.state = response.data.QueryExecution.Status.State
        }
        if (
          'ResultConfiguration' in response.data.QueryExecution &&
          'OutputLocation' in response.data.QueryExecution.Status
        ) {
          event.response.resultLocation =
            response.data.QueryExecution.ResultConfiguration.OutputLocation
        }
        event.response.queryId = response.data.QueryExecutionId
        event.response.query = response.data.Query
        break
      case 'getQueryResults':
        event.response.rowCount = response.data.ResultSet.Rows.length
        break
      case 'startQueryExecution':
        event.response.queryId = response.data.QueryExecutionId
        break
      default:
        break
    }
  },
}

const batchEventCreator = {
  requestHandler(request, event) {
    const parameters = request.params || {}
    const { operation } = request

    switch (operation) {
      case 'submitJob': {
        event.resourceIdentifier = {
          jobName: parameters.jobName,
        }

        event.request.jobDefinition = parameters.jobDefinition
        event.request.jobQueue = parameters.jobQueue
        break
      }

      default:
        break
    }
  },

  responseHandler(response, event) {
    switch (response.request.operation) {
      case 'submitJob':
        event.response.jobId = response.data.jobId
        break

      default:
        break
    }
  },
}

const specificEventCreators = {
  s3: s3EventCreator,
  kinesis: kinesisEventCreator,
  sns: SNSEventCreator,
  sqs: SQSEventCreator,
  ses: SESEventCreator,
  lambda: lambdaEventCreator,
  dynamodb: dynamoDBEventCreator,
  athena: athenaEventCreator,
  batch: batchEventCreator,
}

/**
 * Wraps the aws-sdk Request object send/promise function with tracing
 * @param {Function} wrappedFunction The function to wrap
 * @returns {Function} The wrapped function
 */
function AWSSDKWrapper(wrappedFunction) {
  return function internalAWSSDKWrapper(callback) {
    try {
      const request = this
      const { serviceIdentifier } = request.service.constructor.prototype

      if (!(serviceIdentifier in specificEventCreators)) {
        // resource is not supported yet
        return wrappedFunction.apply(this, [callback])
      }

      const event = tracer.resourceAccessStart(serviceIdentifier, undefined, {
        request: {
          operation: request.operation,
        },
      })

      if ('patchInput' in specificEventCreators[serviceIdentifier]) {
        specificEventCreators[serviceIdentifier].patchInput(this, event)
      }

      request
        .on('send', () => {
          try {
            specificEventCreators[serviceIdentifier].requestHandler(request, event)
          } catch (e) {
            debugLog(e)
          }
        })
        .on('error', (error) => {
          try {
            event.end = Date.now()
            event.error = serializeError(error)
            event.status = 'ERROR'
          } catch (e) {
            debugLog(e)
          }
        })
        .on('complete', (response) => {
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
        })
    } catch (error) {
      debugLog(error)
    }

    return wrappedFunction.apply(this, [callback])
  }
}

function wrapPromiseOnAdd(wrappedFunction) {
  return function internalWrapPromiseOnAdd(promiseDependency) {
    const result = wrappedFunction.apply(this, [promiseDependency])
    try {
      // it is OK to just re-wrap, as the original function overrides
      // `promise` anyway
      patchModule('aws-sdk', 'promise', AWSSDKWrapper, (AWSmod) => AWSmod.Request.prototype)
    } catch (err) {
      debugLog(err)
    }
    return result
  }
}

export default {
  init() {
    patchModule('aws-sdk', 'send', AWSSDKWrapper, (AWSmod) => AWSmod.Request.prototype)
    patchModule('aws-sdk', 'promise', AWSSDKWrapper, (AWSmod) => AWSmod.Request.prototype)
    patchModule('aws-sdk', 'addPromisesToClass', wrapPromiseOnAdd, (AWSmod) => AWSmod.Request)
  },
}
