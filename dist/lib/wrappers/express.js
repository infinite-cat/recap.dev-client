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
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var url_1 = __importDefault(require("url"));
var uuid_1 = require("uuid");
var async_hooks_1 = require("async_hooks");
var shimmer_1 = __importDefault(require("shimmer"));
var utils_1 = require("../module-trackers/http/utils");
var tracer_1 = require("../tracer");
var async_hooks_trace_store_1 = require("../services/async-hooks-trace-store");
var entities_1 = require("../entities");
var log_1 = require("../log");
var newExpressTrace = function (req) {
    var trace = new entities_1.Trace(uuid_1.v4(), process.env.RECAP_DEV_APP_NAME || req.hostname, 'EXPRESS_HANDLER');
    trace.request = {
        headers: req.headers,
        url: req.url,
        method: req.method,
        params: req.params,
        query: req.query,
        body: req.body,
    };
    trace.start = Date.now();
    return trace;
};
function nextWrapper(next) {
    var asyncId = async_hooks_1.executionAsyncId();
    var originalNext = next;
    return function internalNextWrapper(error) {
        var rest = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            rest[_i - 1] = arguments[_i];
        }
        if (error) {
            tracer_1.tracer.setTraceError(error);
        }
        tracer_1.tracer.associateAsyncId(asyncId);
        var result = originalNext.apply(void 0, __spread(rest));
        tracer_1.tracer.associateAsyncId(asyncId);
        return result;
    };
}
function wrapNext(args) {
    var copyArgs = __spread(args);
    var next = copyArgs[copyArgs.length - 1];
    if (next && next.name === 'next') {
        copyArgs[copyArgs.length - 1] = nextWrapper(args[args.length - 1]);
    }
    return copyArgs;
}
function wrapMiddleware(middleware) {
    return function internalMiddlewareWrapper() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return middleware.apply(this, wrapNext(args));
    };
}
function wrapMethod(original) {
    return function internalMethodWrapper() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return original.apply(this, args.map(function (argument) {
            if (argument && typeof argument === 'function') {
                return wrapMiddleware(argument);
            }
            return argument;
        }));
    };
}
function wrapUse(original) {
    return function internalUseWrapper() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return original.apply(this, args.map(function (argument) {
            if (argument && typeof argument === 'function') {
                return wrapMiddleware(argument);
            }
            return argument;
        }));
    };
}
var recapExpressMiddleware = function (req, res, next) {
    var originalUrl = url_1.default.parse(req.originalUrl);
    if (utils_1.isUrlIgnored(originalUrl.path, originalUrl.hostname)) {
        log_1.debugLog("Ignoring request: " + req.method + " " + req.originalUrl);
        next();
        return;
    }
    var trace;
    try {
        trace = tracer_1.tracer.startNewTrace(newExpressTrace(req));
        var handlerFunctionEvent_1 = tracer_1.tracer.functionStart('', 'handler');
        res.once('finish', function () {
            try {
                trace.response = {
                    headers: res.getHeaders(),
                    statusCode: res.statusCode,
                };
                tracer_1.tracer.functionEnd(handlerFunctionEvent_1);
                trace.end = Date.now();
                if (res.statusCode >= 500) {
                    trace.status = 'ERROR';
                }
            }
            catch (err) {
                log_1.debugLog(err);
                tracer_1.tracer.setTraceError(err);
            }
            tracer_1.tracer.sync().then(function () {
                // traceContext.destroyAsync(asyncHooks.executionAsyncId(), true)
            });
        });
    }
    catch (err) {
        log_1.debugLog(err);
    }
    finally {
        next();
    }
};
function wrapExpress(wrappedFunction) {
    tracer_1.tracer.setTraceStore(new async_hooks_trace_store_1.AsyncHooksTraceStore());
    return function internalExpressWrapper() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var result = wrappedFunction.apply.apply(wrappedFunction, __spread([this], args));
        this.use(recapExpressMiddleware);
        return result;
    };
}
var methods = [
    'get',
    'post',
    'put',
    'head',
    'delete',
    'options',
    'trace',
    'copy',
    'lock',
    'mkcol',
    'move',
    'purge',
    'propfind',
    'proppatch',
    'unlock',
    'report',
    'mkactivity',
    'checkout',
    'merge',
    'm-search',
    'notify',
    'subscribe',
    'unsubscribe',
    'patch',
    'search',
    'connect',
];
/**
 * Wraps express with recap.dev tracing.
 * @param {function} express - Express module to wrap.
 * @example
 * import express from 'express'
 * import { traceExpress } from '@recap.dev/client'
 * traceExpress(express)
 * const tracedApp = express()
 */
exports.traceExpress = function (express) {
    var e_1, _a;
    shimmer_1.default.wrap(express.application, 'init', wrapExpress);
    shimmer_1.default.wrap(express.Router, 'use', wrapUse);
    try {
        for (var methods_1 = __values(methods), methods_1_1 = methods_1.next(); !methods_1_1.done; methods_1_1 = methods_1.next()) {
            var method = methods_1_1.value;
            shimmer_1.default.wrap(express.Route.prototype, method, wrapMethod);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (methods_1_1 && !methods_1_1.done && (_a = methods_1.return)) _a.call(methods_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
};
//# sourceMappingURL=express.js.map