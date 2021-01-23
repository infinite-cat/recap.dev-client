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
var http_1 = __importDefault(require("http"));
var https_1 = __importDefault(require("https"));
var url_1 = __importDefault(require("url"));
var shimmer_1 = __importDefault(require("shimmer"));
var utils_1 = require("./utils");
var log_1 = require("../../log");
var config_1 = require("../../config");
var utils_2 = require("../utils");
var tracer_1 = require("../../tracer");
function buildParams(url, options, callback) {
    if (url && options) {
        // in case of both input and options returning all three
        return [url, options, callback];
    }
    if (url && !options) {
        // in case of missing options returning only url and callback
        return [url, callback];
    }
    // url is missing - returning options and callback
    return [options, callback];
}
function responseOnWrapper(wrappedResFunction, chunks) {
    return function internalResponseOnWrapper(resEvent, resCallback) {
        if (resEvent !== 'data' || typeof resCallback !== 'function') {
            return wrappedResFunction.apply(this, [resEvent, resCallback]);
        }
        var resPatchedCallback = function (chunk) {
            utils_1.addChunk(chunk, chunks);
            return resCallback(chunk);
        };
        return wrappedResFunction.apply(this, [resEvent, resPatchedCallback.bind(this)]);
    };
}
function requestOnWrapper(wrappedReqFunction, chunks) {
    return function internalRequestOnWrapper(reqEvent, reqCallback) {
        if (reqEvent !== 'response'
            || typeof reqCallback !== 'function') {
            return wrappedReqFunction.apply(this, [reqEvent, reqCallback]);
        }
        var reqPatchedCallback = function (res) {
            if (res && res.RECAP_DEV_PATCHED) {
                return reqCallback(res);
            }
            res.RECAP_DEV_PATCHED = true;
            shimmer_1.default.wrap(res, 'on', function (wrapped) { return responseOnWrapper(wrapped, chunks); });
            return reqCallback(res);
        };
        return wrappedReqFunction.apply(this, [reqEvent, reqPatchedCallback.bind(this)]);
    };
}
function httpWrapper(wrappedFunction) {
    return function internalHttpWrapper(a, b, c) {
        var url = a;
        var options = b;
        var callback = c;
        var chunks = [];
        if (!(['string', 'URL'].includes(typeof url)) && !callback) {
            callback = b;
            options = a;
            url = undefined;
        }
        if ((typeof options === 'function') && (!callback)) {
            callback = options;
            options = null;
        }
        if (callback && callback.recapDevWrapped) {
            // https->http cases
            return wrappedFunction.apply(this, [a, b, c]);
        }
        var clientRequest;
        try {
            var parsedUrl = url;
            if (typeof parsedUrl === 'string') {
                parsedUrl = url_1.default.parse(parsedUrl);
            }
            var hostname = ((parsedUrl && parsedUrl.hostname)
                || (parsedUrl && parsedUrl.host)
                || (options && options.hostname)
                || (options && options.host)
                || (options && options.uri && options.uri.hostname)
                || 'localhost');
            var path = ((parsedUrl && parsedUrl.path)
                || (options && options.path)
                || ('/'));
            var pathname = ((parsedUrl && parsedUrl.pathname)
                || (options && options.pathname)
                || ('/'));
            var headers_1 = ((options && options.headers) || {});
            if (utils_1.isUrlIgnored(hostname, path)) {
                log_1.debugLog("filtered blacklist hostname " + hostname);
                return wrappedFunction.apply(this, [a, b, c]);
            }
            // TODO: Inject headers here to allow cross-application tracing:
            // const recapDevTraceId = generateRecapDevTraceId()
            // headers['recap-dev-trace-id'] = recapDevTraceId
            //
            var agent = (
            // eslint-disable-next-line no-underscore-dangle
            (options && options.agent) || (options && options._defaultAgent)
                || undefined);
            var port = ((parsedUrl && parsedUrl.port) || (options && options.port)
                || (options && options.defaultPort) || (agent && agent.defaultPort) || 80);
            var protocol = ((parsedUrl && parsedUrl.protocol)
                || (port === 443 && 'https:')
                || (options && options.protocol)
                || (agent && agent.protocol)
                || 'http:');
            protocol = protocol.slice(0, -1);
            var body_1 = (options
                && options.body
                && (options.body instanceof String || options.body instanceof Buffer)) ? options.body : '';
            var method = (options && options.method) || 'GET';
            var requestUrl = protocol + "://" + hostname + pathname;
            var event_1 = tracer_1.tracer.resourceAccessStart(hostname, {
                host: hostname,
                url: requestUrl,
            }, {
                request: {
                    url: requestUrl,
                    method: method,
                    headers: headers_1,
                    operation: method,
                },
            });
            if (body_1) {
                log_1.debugLog("Set request body=" + body_1);
            }
            if (body_1) {
                log_1.debugLog("Set request body=" + body_1);
            }
            var patchedCallback = function (res) {
                event_1.response.status = res.statusCode;
                event_1.response.headers = res.headers;
                if (res.statusCode >= 400) {
                    event_1.status = 'ERROR';
                    event_1.error = utils_2.serializeError(new Error("Response code: " + res.statusCode));
                }
                else {
                    event_1.status = 'OK';
                }
                // Override request headers if they are present here. In some libs they are not
                // available on `options.headers`
                if (res.req && res.req.getHeaders()) {
                    event_1.response.headers = res.req.getHeaders();
                }
                if (headers_1 && 'x-amzn-requestid' in headers_1) {
                    event_1.serviceName = 'api-gateway';
                }
                if (callback && typeof callback === 'function') {
                    callback(res);
                }
            };
            // @ts-ignore
            patchedCallback.recapDevWrapped = true;
            clientRequest = wrappedFunction.apply(this, buildParams(url, options, patchedCallback));
            if (options
                && options.recapDevSkipResponseData
                && config_1.config.disablePayloadCapture) {
                shimmer_1.default.wrap(clientRequest, 'on', function (wrapped) { return requestOnWrapper(wrapped, chunks); });
            }
            var WriteWrapper = function (wrappedWriteFunc) {
                return function internalWriteWrapper() {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    try {
                        if ((!body_1 || body_1 === '') && args[0] && ((typeof args[0] === 'string') || (args[0] instanceof Buffer))) {
                            event_1.request.body = utils_1.decodeJson(body_1, args[0]);
                        }
                    }
                    catch (err) {
                        log_1.debugLog('Could not parse request body in write wrapper');
                    }
                    return wrappedWriteFunc.apply(this, args);
                };
            };
            var endWrapper = function (wrappedEndFunc) {
                return function internalEndWrapper() {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    try {
                        if ((!body_1 || body_1 === '') && args[0] && ((typeof args[0] === 'string') || (args[0] instanceof Buffer))) {
                            event_1.request.body = utils_1.decodeJson(body_1, args[0]);
                        }
                    }
                    catch (err) {
                        log_1.debugLog('Could not parse request body in end wrapper');
                    }
                    return wrappedEndFunc.apply(this, args);
                };
            };
            try {
                shimmer_1.default.wrap(clientRequest, 'write', WriteWrapper);
                shimmer_1.default.wrap(clientRequest, 'end', endWrapper);
            }
            catch (err) {
                // In some libs it might not be possible to hook on write
            }
            var isTimeout_1 = false;
            clientRequest.on('timeout', function () {
                isTimeout_1 = true;
            });
            clientRequest.once('error', function (error) {
                var patchedError = new Error();
                patchedError.message = error.message;
                patchedError.stack = error.stack;
                patchedError.name = error.name;
                if (isTimeout_1) {
                    patchedError.message += '\nTimeout exceeded';
                }
                if (clientRequest.aborted) {
                    patchedError.message += '\nRequest aborted';
                }
                event_1.end = Date.now();
                event_1.status = 'ERROR';
                event_1.error = utils_2.serializeError(patchedError);
                if (clientRequest.listenerCount('error') === 0) {
                    throw error;
                }
            });
            clientRequest.on('response', function (res) {
                if ((!options || (options && !options.recapDevSkipResponseData))
                    && !config_1.config.disablePayloadCapture) {
                    res.on('data', function (chunk) { return utils_1.addChunk(chunk, chunks); });
                }
                res.on('end', function () {
                    var responsePayload = utils_1.decodeJson(Buffer.concat(chunks), res.headers['content-encoding']);
                    event_1.status = 'OK';
                    event_1.end = Date.now();
                    event_1.response.body = responsePayload;
                });
            });
        }
        catch (error) {
            log_1.debugLog(error);
        }
        if (!clientRequest) {
            clientRequest = wrappedFunction.apply(this, [a, b, c]);
        }
        return clientRequest;
    };
}
function httpGetWrapper(module) {
    return function internalHttpGetWrapper(url, options, callback) {
        var req = module.request(url, options, callback);
        req.end();
        return req;
    };
}
function fetchH2Wrapper(wrappedFunc) {
    return function internalFetchH2Wrapper(options) {
        return wrappedFunc.apply(this, [__assign(__assign({}, options), { recapDevSkipResponseData: true })]);
    };
}
exports.trackHttp = function () {
    // @ts-ignore
    shimmer_1.default.wrap(http_1.default, 'get', function () { return httpGetWrapper(http_1.default); });
    // @ts-ignore
    shimmer_1.default.wrap(http_1.default, 'request', httpWrapper);
    // @ts-ignore
    shimmer_1.default.wrap(https_1.default, 'get', function () { return httpGetWrapper(https_1.default); });
    // @ts-ignore
    shimmer_1.default.wrap(https_1.default, 'request', httpWrapper);
    utils_2.patchModule('fetch-h2/dist/lib/context-http1', 'connect', fetchH2Wrapper, function (fetch) { return fetch.OriginPool.prototype; });
};
//# sourceMappingURL=http.js.map