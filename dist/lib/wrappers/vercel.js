"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var uuid_1 = require("uuid");
var callsites_1 = __importDefault(require("callsites"));
var lodash_es_1 = require("lodash-es");
var console_1 = require("./console");
var entities_1 = require("../entities");
var tracer_1 = require("../tracer");
var log_1 = require("../log");
var utils_1 = require("../utils");
var newVercelTrace = function (request, unitName) {
    var trace = new entities_1.Trace(uuid_1.v4(), unitName, 'VERCEL');
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
var defaultUnitNameStrategy = function () { return (process.env.VERCEL_ENV + '/' + callsites_1.default()[1].getFileName()); };
/**
 * Wraps a Vercel handler with recap.dev tracing
 * @param {Function} func - A handler function to wrap
 * @param {Function | string} [unitName] - Either a unitName string or a function to compute one
 * @returns {Function} Wrapped handler function
 */
exports.wrapVercelHandler = function (func, unitName) {
    if (unitName === void 0) { unitName = defaultUnitNameStrategy; }
    var wrappedVercelHandler = function (request, response) {
        try {
            var name_1 = lodash_es_1.isFunction(unitName) ? unitName() : unitName;
            var trace_1 = tracer_1.tracer.startNewTrace(newVercelTrace(request, name_1));
            var handlerFunctionEvent_1 = tracer_1.tracer.functionStart('', 'handler');
            var originalWrite_1 = response.write;
            var originalEnd_1 = response.end;
            var resBody_1 = '';
            // Handling response body
            response.write = function write() {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                resBody_1 = utils_1.appendBodyChunk(args[0], resBody_1);
                return originalWrite_1.apply(response, args);
            };
            response.end = function end() {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                resBody_1 = utils_1.appendBodyChunk(args[0], resBody_1);
                try {
                    trace_1.response = {
                        headers: response.getHeaders(),
                        statusCode: response.statusCode,
                        body: utils_1.safeParse(resBody_1) || resBody_1,
                    };
                    tracer_1.tracer.functionEnd(handlerFunctionEvent_1);
                    trace_1.end = Date.now();
                    if (response.statusCode >= 500) {
                        trace_1.status = 'ERROR';
                    }
                }
                catch (err) {
                    log_1.debugLog(err);
                    tracer_1.tracer.setTraceError(err);
                }
                tracer_1.tracer.sync().then(function () {
                    originalEnd_1.apply(response, args);
                });
            };
        }
        catch (err) {
            log_1.debugLog(err);
        }
        func(request, response);
    };
    console_1.captureConsoleLogs();
    return wrappedVercelHandler;
};
//# sourceMappingURL=vercel.js.map