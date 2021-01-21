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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var shimmer_1 = __importDefault(require("shimmer"));
var lodash_es_1 = require("lodash-es");
var tracer_1 = require("../tracer");
/**
 * Captures following methods of the global console object with recap.dev tracing:
 * log, error, info, trace, warn, dir
 * This will add all messages to a current trace
 * @example
 * import { captureConsoleLogs } from '@recap.dev/client'
 * captureConsoleLogs()
 */
exports.captureConsoleLogs = function () {
    var consoleLogWrapper = function (original) { return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        tracer_1.tracer.addLogEntry(args.map(function (arg) {
            if (lodash_es_1.isObject(arg)) {
                return JSON.stringify(arg);
            }
            return arg;
        }).join());
        return original.apply(void 0, __spread(args));
    }; };
    shimmer_1.default.massWrap([console], ['log', 'error', 'info', 'trace', 'warn', 'dir'], consoleLogWrapper);
};
//# sourceMappingURL=console.js.map