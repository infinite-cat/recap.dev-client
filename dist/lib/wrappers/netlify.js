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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var config_1 = require("../config");
var tracer_1 = require("../tracer");
var entities_1 = require("../entities");
var utils_1 = require("../utils");
var log_1 = require("../log");
var console_1 = require("./console");
var newNetlifyTrace = function (request, context) {
    var trace = new entities_1.Trace(context.awsRequestId, process.env.SITE_NAME + request.path, 'NETLIFY_FUNCTION');
    trace.request = __assign({}, request);
    trace.extraData.awsRegion = process.env.AWS_REGION;
    trace.extraData.awsAccountId = context
        && context.invokedFunctionArn
        && context.invokedFunctionArn.split(':')[4];
    trace.extraData.awsLogStreamName = context && context.logStreamName;
    return trace;
};
/**
 * Wraps Netlify handler with recap.dev tracing
 * @param {function} func - The request handler function.
 */
exports.wrapNetlifyHandler = function (func) {
    console_1.captureConsoleLogs();
    var wrappedLambdaHandler = function (request, context) { return __awaiter(void 0, void 0, void 0, function () {
        var trace, event, timeoutHandler, result, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!context) {
                        log_1.debugLog('No lambda context passed, skipping recap.dev tracing');
                        return [2 /*return*/, func(request, context)];
                    }
                    trace = tracer_1.tracer.startNewTrace(newNetlifyTrace(request, context));
                    event = tracer_1.tracer.functionStart('', request.path);
                    if (context.getRemainingTimeInMillis) {
                        timeoutHandler = setTimeout(function () {
                            tracer_1.tracer.functionEnd(event);
                            tracer_1.tracer.sync();
                        }, context.getRemainingTimeInMillis() - config_1.config.serverlessTimeoutWindow);
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 2, , 4]);
                    result = func(request, context);
                    return [3 /*break*/, 4];
                case 2:
                    e_1 = _a.sent();
                    tracer_1.tracer.functionEnd(event);
                    tracer_1.tracer.setTraceError(e_1.toString());
                    clearTimeout(timeoutHandler);
                    return [4 /*yield*/, tracer_1.tracer.sync()];
                case 3:
                    _a.sent();
                    throw e_1;
                case 4:
                    if (utils_1.isPromise(result)) {
                        return [2 /*return*/, result
                                .then(function (resolvedResult) {
                                tracer_1.tracer.functionEnd(event);
                                trace.response = __assign({}, resolvedResult);
                                clearTimeout(timeoutHandler);
                                return tracer_1.tracer.sync().then(function () { return resolvedResult; });
                            })
                                .catch(function (err) {
                                tracer_1.tracer.functionEnd(event);
                                tracer_1.tracer.setTraceError(err);
                                clearTimeout(timeoutHandler);
                                return tracer_1.tracer.sync().then(function () {
                                    throw err;
                                });
                            })];
                    }
                    trace.response = __assign({}, result);
                    tracer_1.tracer.functionEnd(event);
                    clearTimeout(timeoutHandler);
                    return [2 /*return*/, tracer_1.tracer.sync().then(function () { return result; })];
            }
        });
    }); };
    wrappedLambdaHandler.recapDevWrapped = true;
    return wrappedLambdaHandler;
};
//# sourceMappingURL=netlify.js.map