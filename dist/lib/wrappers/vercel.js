"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var uuid_1 = require("uuid");
var console_1 = require("./console");
var entities_1 = require("../entities");
var tracer_1 = require("../tracer");
var log_1 = require("../log");
var newVercelTrace = function (request) {
    var trace = new entities_1.Trace(uuid_1.v4(), request.path, 'VERCEL');
    trace.request = {
        headers: request.getHeaders(),
        url: request.path,
        method: request.method,
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
        response.once('finish', function () {
            try {
                trace.response = {
                    headers: response.getHeaders(),
                    statusCode: response.statusCode,
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
            tracer_1.tracer.sync();
        });
        func(request, response);
    };
    console_1.captureConsoleLogs();
    return wrappedVercelHandler;
};
//# sourceMappingURL=vercel.js.map