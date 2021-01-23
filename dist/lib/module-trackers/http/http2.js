"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var shimmer_1 = __importDefault(require("shimmer"));
var url_1 = __importDefault(require("url"));
var utils_1 = require("../utils");
var utils_2 = require("./utils");
var config_1 = require("../../config");
var log_1 = require("../../log");
var tracer_1 = require("../../tracer");
var http2 = utils_1.tryRequire('http2');
var extractHeaders = function (headers) { return Object.entries(headers)
    .filter(function (header) { return !header[0].startsWith(':'); })
    .reduce(function (obj, header) {
    var _a = __read(header, 2), key = _a[0], value = _a[1];
    obj[key] = value;
    return obj;
}, {}); };
function httpWrapper(wrappedFunction, authority) {
    return function internalHttpWrapper(headers, options) {
        var clientRequest = null;
        var event;
        try {
            var hostname = url_1.default.parse(authority).hostname;
            if (utils_2.isUrlIgnored(hostname, headers[':path'])) {
                log_1.debugLog("filtered blacklist hostname " + hostname);
                return wrappedFunction.apply(this, [headers, options]);
            }
            var reqHeaders = extractHeaders(headers);
            // TODO: Inject headers here to allow cross-application tracing:
            // const recapDevTraceId = generateRecapDevTraceId()
            // headers['recap-dev-trace-id'] = recapDevTraceId
            //
            event = tracer_1.tracer.resourceAccessStart(hostname, {
                host: hostname,
                url: authority,
            }, {
                request: {
                    url: authority,
                    method: headers[':method'],
                    headers: reqHeaders,
                    operation: headers[':method'],
                },
            });
        }
        catch (error) {
            log_1.debugLog(error);
            return wrappedFunction.apply(this, [headers, options]);
        }
        try {
            clientRequest = wrappedFunction.apply(this, [headers, options]);
        }
        catch (err) {
            event.end = Date.now();
            event.status = 'ERROR';
            event.error = utils_1.serializeError(err);
            throw err;
        }
        try {
            var chunks_1 = [];
            var responseHeaders_1;
            if (!config_1.config.disablePayloadCapture) {
                clientRequest.on('data', function (chunk) {
                    utils_2.addChunk(chunk, chunks_1);
                });
            }
            clientRequest.once('error', function (error) {
                event.end = Date.now();
                event.status = 'ERROR';
                event.error = utils_1.serializeError(error);
                if (clientRequest.listenerCount('error') === 0) {
                    throw error; // no error listener, we should explode
                }
            });
            clientRequest.once('close', function () {
                event.end = Date.now();
                if (!config_1.config.disablePayloadCapture) {
                    event.response.body = utils_2.decodeJson(Buffer.concat(chunks_1), responseHeaders_1['content-encoding']);
                }
            });
            clientRequest.once('response', function (res) {
                event.end = Date.now();
                event.status = 'OK';
                var statusCode = res[':status'];
                if (statusCode >= 400) {
                    event.status = 'ERROR';
                    event.error = utils_1.serializeError(new Error("Response code: " + res.statusCode));
                }
                if (headers && 'x-amzn-requestid' in headers) {
                    event.serviceName = 'api-gateway';
                }
                responseHeaders_1 = extractHeaders(res);
                event.response.status = statusCode;
                event.response.headers = responseHeaders_1;
            });
        }
        catch (error) {
            log_1.debugLog(error);
        }
        return clientRequest;
    };
}
function wrapHttp2Connect(connectFunction) {
    return function innerWrapHttp2Connect(authority, options, listener) {
        var clientSession = connectFunction.apply(this, [authority, options, listener]);
        try {
            shimmer_1.default.wrap(clientSession, 'request', function (wrappedFunction) { return httpWrapper(wrappedFunction, authority); });
        }
        catch (err) {
            log_1.debugLog("Could not instrument http2 session request " + err);
        }
        return clientSession;
    };
}
exports.trackHttp2 = function () {
    if (http2) {
        log_1.debugLog('Patching http2 module');
        shimmer_1.default.wrap(http2, 'connect', wrapHttp2Connect);
    }
};
//# sourceMappingURL=http2.js.map