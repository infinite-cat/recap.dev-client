"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var sqs_sns_trigger_utils_1 = require("./sqs-sns-trigger.utils");
var log_1 = require("../log");
var tracer_1 = require("../tracer");
var s3EventCreator = {
    requestHandler: function (request, event) {
        var parameters = request.params || {};
        var operation = request.operation;
        event.resourceIdentifier = {
            bucketName: parameters.Bucket,
        };
        switch (operation) {
            case 'headObject':
            // fall through
            case 'getObject':
            // fall through
            case 'putObject':
                event.request = {
                    key: parameters.Key,
                    bucketName: parameters.Bucket,
                };
                event.resourceIdentifier = {
                    bucketName: parameters.Bucket,
                    key: parameters.Key,
                };
                break;
            default:
                break;
        }
    },
    responseHandler: function (response, event) {
        switch (response.request.operation) {
            case 'listObjects':
                event.response.files = response.data.Contents.map(function (entry) { return ({
                    key: "" + entry.Key,
                    size: entry.Size,
                    etag: entry.Etag,
                }); });
                break;
            case 'putObject':
                event.response.etag = response.data.ETag.replace(/"/g, '');
                break;
            case 'headObject':
            // fall through
            case 'getObject':
                event.response.fileSize = response.data.ContentLength;
                event.response.etag = response.data.ETag.replace(/"/g, '');
                event.response = response.data.LastModified;
                break;
            default:
                break;
        }
    },
};
var kinesisEventCreator = {
    /**
     * Updates an event with the appropriate fields from a Kinesis request
     * @param {object} request The AWS.Request object
     * @param {proto.event_pb.Event} event The event to update the data on
     */
    requestHandler: function (request, event) {
        var parameters = request.params || {};
        event.resourceIdentifier = {
            streamName: parameters.StreamName,
            paritionKey: parameters.PartitionKey,
        };
        event.request.data = parameters.Data;
    },
    /**
     * Updates an event with the appropriate fields from a Kinesis response
     * @param {object} response The AWS.Response object
     * @param {proto.event_pb.Event} event The event to update the data on
     */
    responseHandler: function (response, event) {
        switch (response.request.operation) {
            case 'putRecord':
                event.response.shardId = response.data.ShardId;
                event.response.sequenceNumber = response.data.SequenceNumber;
                break;
            default:
                break;
        }
    },
};
var SNSEventCreator = {
    requestHandler: function (request, event) {
        var parameters = request.params || {};
        var resourceArn = parameters.TopicArn || parameters.TargetArn;
        event.resourceIdentifier = {
            resourceArn: resourceArn,
        };
        event.request.message = parameters.Message;
    },
    responseHandler: function (response, event) {
        switch (response.request.operation) {
            case 'publish':
                event.response.messageId = response.data.MessageId;
                break;
            default:
                break;
        }
    },
};
var SQSEventCreator = {
    requestHandler: function (request, event) {
        var parameters = request.params || {};
        var queueName;
        if ('QueueUrl' in parameters) {
            queueName = parameters.QueueUrl.split('/').pop();
        }
        if ('QueueName' in parameters) {
            queueName = parameters.QueueName;
        }
        event.resourceIdentifier = {
            queueName: queueName,
        };
        var entry = 'Entries' in parameters ? parameters.Entries : parameters;
        if ('MessageBody' in entry) {
            event.request.messageBody = entry.MessageBody;
        }
        if ('MessageAttributes' in entry) {
            event.request.messageAttributes = entry.MessageAttributes;
        }
    },
    responseHandler: function (response, event) {
        switch (response.request.operation) {
            case 'sendMessage':
                event.response.messageId = response.data.MessageId;
                event.response.bodyMd5 = response.data.MD5OfMessageBody;
                break;
            case 'receiveMessage': {
                var messagesNumber = 0;
                if ('Messages' in response.data && response.data.Messages.length > 0) {
                    messagesNumber = response.data.Messages.length;
                    event.response.messageIds = response.data.Messages.map(function (x) { return x.MessageId; });
                    event.response.snsTrigger = sqs_sns_trigger_utils_1.getSNSTrigger(response.data.Messages);
                    event.response.messagesNumber = messagesNumber;
                }
                break;
            }
            default:
                break;
        }
    },
};
var SESEventCreator = {
    requestHandler: function (request, event) {
        var parameters = request.params || {};
        switch (request.operation) {
            case 'sendEmail':
                event.request.source = parameters.Source;
                event.request.destination = parameters.Destination.ToAddresses;
                event.request.subject = parameters.Message.Subject.Data;
                event.request.messageText = parameters.Message.Body.Text.Data;
                event.request.messageHtml = parameters.Message.Body.Html.Data;
                break;
            default:
                break;
        }
    },
    responseHandler: function (response, event) {
        switch (response.request.operation) {
            case 'sendEmail':
                event.response.messageId = response.data.MessageId;
                break;
            default:
                break;
        }
    },
};
var lambdaEventCreator = {
    requestHandler: function (request, event) {
        var parameters = request.params || {};
        event.resourceIdentifier = {
            functionName: parameters.FunctionName,
        };
        event.request.payload = parameters.Payload;
    },
    responseHandler: function () { },
};
var dynamoDBEventCreator = {
    requestHandler: function (request, event) {
        var e_1, _a;
        var parameters = request.params || {};
        var operation = request.operation;
        event.resourceIdentifier = {
            tableName: parameters.TableName,
        };
        switch (operation) {
            case 'deleteItem':
            case 'getItem':
                event.request.key = parameters.Key;
                break;
            case 'putItem':
                event.request.key = parameters.Key;
                event.request.item = parameters.Item;
                break;
            case 'updateItem':
                event.request.key = parameters.Key;
                event.request.updateExpression = parameters.UpdateExpression;
                event.request.expressionAttributeName = parameters.ExpressionAttributeNames;
                event.request.expressionAttributeValues = parameters.ExpressionAttributeValues;
                break;
            case 'query': {
                event.request.keyConditions = parameters.KeyConditions;
                event.request.queryFilter = parameters.QueryFilter;
                event.request.exclusiveStartKey = parameters.ExclusiveStartKey;
                event.request.projectionExpression = parameters.ProjectionExpression;
                event.request.filterExpression = parameters.FilterExpression;
                event.request.keyConditionExpression = parameters.KeyConditionExpression;
                event.request.expressionAttributeValues = parameters.ExpressionAttributeValues;
                break;
            }
            case 'scan': {
                event.request.keyConditions = parameters.ScanFilter;
                event.request.exclusiveStartKey = parameters.ExclusiveStartKey;
                event.request.projectionExpression = parameters.ProjectionExpression;
                event.request.filterExpression = parameters.FilterExpression;
                event.request.expressionAttributeValues = parameters.ExpressionAttributeValues;
                break;
            }
            case 'batchWriteItem': {
                var tableNames = Object.keys(parameters.RequestItems);
                event.resourceIdentifier = {
                    tableNames: tableNames,
                };
                var addedItems_1 = [];
                var deletedKeys_1 = [];
                try {
                    for (var tableNames_1 = __values(tableNames), tableNames_1_1 = tableNames_1.next(); !tableNames_1_1.done; tableNames_1_1 = tableNames_1.next()) {
                        var tableName = tableNames_1_1.value;
                        parameters.RequestItems[tableName].forEach(function (item) {
                            if (item.PutRequest) {
                                addedItems_1.push(item.PutRequest.Item);
                            }
                            if (item.DeleteRequest) {
                                deletedKeys_1.push(item.DeleteRequest.Key);
                            }
                        });
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (tableNames_1_1 && !tableNames_1_1.done && (_a = tableNames_1.return)) _a.call(tableNames_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                if (addedItems_1.length !== 0) {
                    event.request.addedItems = addedItems_1;
                }
                if (deletedKeys_1.length !== 0) {
                    event.request.deletedKeys = deletedKeys_1;
                }
                break;
            }
            default:
                break;
        }
    },
    responseHandler: function (response, event) {
        switch (response.request.operation) {
            case 'getItem':
                event.response.item = response.data.Item;
                break;
            case 'listTables':
                event.response.tableNames = response.data.TableNames;
                break;
            case 'scan':
            case 'query': {
                event.response.items = response.data.Items;
                event.response.lastEvaluatedKey = response.data.LastEvaluatedKey;
                break;
            }
            default:
                break;
        }
    },
};
var athenaEventCreator = {
    requestHandler: function (request, event) {
        var parameters = request.params || {};
        switch (request.operation) {
            case 'startQueryExecution':
                if ('QueryExecutionContext' in parameters
                    && 'Database' in parameters.QueryExecutionContext) {
                    event.resourceIdentifier = {
                        database: parameters.QueryExecutionContext.Database,
                    };
                }
                event.request.query = parameters.QueryString;
                break;
            case 'getQueryExecution':
            case 'getQueryResults':
            case 'stopQueryExecution':
                event.request.queryExecutionId = parameters.QueryExecutionId;
                break;
            default:
                break;
        }
    },
    responseHandler: function (response, event) {
        switch (response.request.operation) {
            case 'getQueryExecution':
                if ('Status' in response.data.QueryExecution
                    && 'State' in response.data.QueryExecution.Status) {
                    event.response.state = response.data.QueryExecution.Status.State;
                }
                if ('ResultConfiguration' in response.data.QueryExecution
                    && 'OutputLocation' in response.data.QueryExecution.Status) {
                    event.response.resultLocation = response.data.QueryExecution.ResultConfiguration.OutputLocation;
                }
                event.response.queryId = response.data.QueryExecutionId;
                event.response.query = response.data.Query;
                break;
            case 'getQueryResults':
                event.response.rowCount = response.data.ResultSet.Rows.length;
                break;
            case 'startQueryExecution':
                event.response.queryId = response.data.QueryExecutionId;
                break;
            default:
                break;
        }
    },
};
var batchEventCreator = {
    requestHandler: function (request, event) {
        var parameters = request.params || {};
        var operation = request.operation;
        switch (operation) {
            case 'submitJob': {
                event.resourceIdentifier = {
                    jobName: parameters.jobName,
                };
                event.request.jobDefinition = parameters.jobDefinition;
                event.request.jobQueue = parameters.jobQueue;
                break;
            }
            default:
                break;
        }
    },
    responseHandler: function (response, event) {
        switch (response.request.operation) {
            case 'submitJob':
                event.response.jobId = response.data.jobId;
                break;
            default:
                break;
        }
    },
};
var specificEventCreators = {
    s3: s3EventCreator,
    kinesis: kinesisEventCreator,
    sns: SNSEventCreator,
    sqs: SQSEventCreator,
    ses: SESEventCreator,
    lambda: lambdaEventCreator,
    dynamodb: dynamoDBEventCreator,
    athena: athenaEventCreator,
    batch: batchEventCreator,
};
/**
 * Wraps the aws-sdk Request object send/promise function with tracing
 * @param {Function} wrappedFunction The function to wrap
 * @returns {Function} The wrapped function
 */
function AWSSDKWrapper(wrappedFunction) {
    return function internalAWSSDKWrapper(callback) {
        try {
            var request_1 = this;
            var serviceIdentifier_1 = request_1.service.constructor.prototype.serviceIdentifier;
            if (!(serviceIdentifier_1 in specificEventCreators)) {
                // resource is not supported yet
                return wrappedFunction.apply(this, [callback]);
            }
            var event_1 = tracer_1.tracer.resourceAccessStart(serviceIdentifier_1, undefined, {
                request: {
                    operation: request_1.operation,
                },
            });
            if ('patchInput' in specificEventCreators[serviceIdentifier_1]) {
                specificEventCreators[serviceIdentifier_1].patchInput(this, event_1);
            }
            request_1
                .on('send', function () {
                try {
                    specificEventCreators[serviceIdentifier_1].requestHandler(request_1, event_1);
                }
                catch (e) {
                    log_1.debugLog(e);
                }
            })
                .on('error', function (error) {
                try {
                    event_1.end = Date.now();
                    event_1.error = utils_1.serializeError(error);
                    event_1.status = 'ERROR';
                }
                catch (e) {
                    log_1.debugLog(e);
                }
            })
                .on('complete', function (response) {
                try {
                    event_1.end = Date.now();
                    event_1.status = 'OK';
                    event_1.request.requestId = response.requestId;
                    if (response.data) {
                        event_1.response.statusCode = response.httpResponse.statusCode;
                        event_1.status = 'OK';
                        specificEventCreators[serviceIdentifier_1].responseHandler(response, event_1);
                    }
                    if (response.error !== null) {
                        event_1.error = JSON.stringify(response.error);
                        event_1.status = 'ERROR';
                    }
                }
                catch (e) {
                    log_1.debugLog(e);
                }
            });
        }
        catch (error) {
            log_1.debugLog(error);
        }
        return wrappedFunction.apply(this, [callback]);
    };
}
function wrapPromiseOnAdd(wrappedFunction) {
    return function internalWrapPromiseOnAdd(promiseDependency) {
        var result = wrappedFunction.apply(this, [promiseDependency]);
        try {
            // it is OK to just re-wrap, as the original function overrides
            // `promise` anyway
            utils_1.patchModule('aws-sdk', 'promise', AWSSDKWrapper, function (AWSmod) { return AWSmod.Request.prototype; });
        }
        catch (err) {
            log_1.debugLog(err);
        }
        return result;
    };
}
exports.default = {
    init: function () {
        utils_1.patchModule('aws-sdk', 'send', AWSSDKWrapper, function (AWSmod) { return AWSmod.Request.prototype; });
        utils_1.patchModule('aws-sdk', 'promise', AWSSDKWrapper, function (AWSmod) { return AWSmod.Request.prototype; });
        utils_1.patchModule('aws-sdk', 'addPromisesToClass', wrapPromiseOnAdd, function (AWSmod) { return AWSmod.Request; });
    },
};
//# sourceMappingURL=aws-sdk.js.map