"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_es_1 = require("lodash-es");
var snsEventProperties = [
    'Type',
    'MessageId',
    'TopicArn',
    'Message',
    'Timestamp',
    'SignatureVersion',
    'Signature',
];
exports.getSNSTrigger = function (messages) {
    var snsEvent = null;
    messages.some(function (message) {
        try {
            var body = null;
            if (message.Body) {
                body = JSON.parse(message.Body);
            }
            else if (message.body) {
                body = JSON.parse(message.body);
            }
            else {
                return true;
            }
            if (lodash_es_1.intersection(Object.keys(body), snsEventProperties).length >= snsEventProperties.length) {
                snsEvent = body;
                return true;
            }
        }
        catch (ex) {
            // Continue to the next message
        }
        return true;
    });
    return snsEvent;
};
//# sourceMappingURL=sqs-sns-trigger.utils.js.map