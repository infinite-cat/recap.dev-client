"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var url_1 = __importDefault(require("url"));
var log_1 = require("../log");
var utils_1 = require("./utils");
var tracer_1 = require("../tracer");
var eventsMap = {};
var getResponse = function (event) {
    var commandName = event.commandName, reply = event.reply;
    switch (commandName) {
        case 'find':
            if (reply.cursor && Array.isArray(reply.cursor.firstBatch)) {
                return { itemsCount: reply.cursor.firstBatch.length, firstBatch: reply.cursor.firstBatch };
            }
            if (Array.isArray(reply)) {
                return { reply: reply };
            }
            break;
        case 'getMore':
            if (reply.cursor && Array.isArray(reply.cursor.nextBatch)) {
                return { itemsCount: reply.cursor.nextBatch.length, nextBatch: reply.cursor.nextBatch };
            }
            if (Array.isArray(reply)) {
                return { reply: reply };
            }
            break;
        case 'count':
            if (reply.ok) {
                return { itemsCount: reply.n };
            }
            if (Array.isArray(reply)) {
                return { reply: reply };
            }
            break;
        default:
            return {};
    }
    return {};
};
function getConnectionDetails(connectionId) {
    if (connectionId) {
        if (typeof connectionId === 'string') {
            var parsedUrl = url_1.default.parse(connectionId);
            return { host: parsedUrl.hostname, port: parsedUrl.port };
        }
        if (connectionId.domainSocket) {
            return { host: 'localhost', port: connectionId.port };
        }
        return { host: connectionId.host, port: connectionId.port };
    }
    return { host: undefined, port: undefined };
}
function onStartHook(event) {
    try {
        var _a = getConnectionDetails(event === null || event === void 0 ? void 0 : event.connectionId), host = _a.host, port = _a.port;
        var collection = event.command.collection || event.command[event.commandName];
        if (typeof collection !== 'string') {
            collection = '';
        }
        var mongoDbEvent = tracer_1.tracer.resourceAccessStart('mongodb', {
            host: host,
            port: port,
            database: event.databaseName,
            collection: collection,
        }, {
            request: __assign(__assign({}, event.command), { operation: event.commandName }),
        });
        eventsMap[event.requestId] = mongoDbEvent;
    }
    catch (error) {
        log_1.debugLog(error);
    }
}
function handleResponse(event, hasError) {
    if (hasError === void 0) { hasError = false; }
    try {
        var endTime = Date.now();
        var mongoDbEvent = eventsMap[event.requestId];
        mongoDbEvent.end = endTime;
        mongoDbEvent.status = hasError ? 'ERROR' : 'OK';
        mongoDbEvent.response = getResponse(event);
        delete eventsMap[event.requestId];
    }
    catch (error) {
        log_1.debugLog(error);
    }
}
function onSuccessHook(event) {
    handleResponse(event);
}
function onFailureHook(event) {
    handleResponse(event, true);
}
exports.trackMongoDb = function () {
    var modules = utils_1.getModules('mongodb');
    log_1.debugLog("recap.dev patching " + modules.length + " mongodb modules");
    modules.forEach(function (mongodb) {
        var listener = mongodb.instrument({}, function (error) {
            if (error) {
                log_1.debugLog('recap.dev mongodb instrumentation error', error);
            }
        });
        listener.on('started', onStartHook);
        listener.on('succeeded', onSuccessHook);
        listener.on('failed', onFailureHook);
    });
};
//# sourceMappingURL=mongodb.js.map