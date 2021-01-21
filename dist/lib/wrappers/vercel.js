"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var uuid_1 = require("uuid");
var console_1 = require("./console");
var entities_1 = require("../entities");
var tracer_1 = require("../tracer");
var log_1 = require("../log");
var utils_1 = require("../utils");
var newVercelTrace = function (request) {
    var trace = new entities_1.Trace(uuid_1.v4(), request.path, 'VERCEL');
    trace.request = {
        headers: request.rawHeaders,
        url: request.url,
        method: request.method,
        params: request.params,
        query: request.query,
        body: request.body,
    };
    return trace;
};
/**
 * Wraps a Vercel handler with recap.dev tracing
 * @param {Function} func - A handler function to wrap
 * @returns {Function} Wrapped handler function
 */
exports.wrapVercelHandler = function (func) {
    var wrappedVercelHandler = function (request, response) {
        var trace = tracer_1.tracer.startNewTrace(newVercelTrace(request));
        var handlerFunctionEvent = tracer_1.tracer.functionStart('', 'handler');
        var originalWrite = response.write;
        var originalEnd = response.end;
        var resBody = '';
        // Handling response body
        response.write = function write() {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            resBody = utils_1.appendBodyChunk(args[0], resBody);
            return originalWrite.apply(response, args);
        };
        response.end = function end() {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            resBody = utils_1.appendBodyChunk(args[0], resBody);
            originalEnd.apply(response, args);
        };
        response.once('finish', function () {
            try {
                trace.response = {
                    headers: response.getHeaders(),
                    statusCode: response.statusCode,
                    body: utils_1.safeParse(resBody) || resBody,
                };
                tracer_1.tracer.functionEnd(handlerFunctionEvent);
                trace.end = Date.now();
                if (response.statusCode >= 500) {
                    trace.status = 'ERROR';
                }
            }
            catch (err) {
                log_1.debugLog(err);
                tracer_1.tracer.setTraceError(err);
            }
            tracer_1.tracer.sync().then(function () {
            });
        });
        func(request, response);
    };
    console_1.captureConsoleLogs();
    return wrappedVercelHandler;
};
//# sourceMappingURL=vercel.js.map