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
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_es_1 = require("lodash-es");
require("reflect-metadata");
var utils_1 = require("../utils");
var tracer_1 = require("../tracer");
/**
 * Wraps a function with recap.dev tracing.
 * This will record all the function calls and add them to a current trace.
 * @param {string} fileName - Name of the file where function is declared.
 * @param {string} functionName - Name of the function.
 * @param {function} func - The function to wrap.
 */
function wrapFunction(fileName, functionName, func) {
    if (func.recapDevWrapped) {
        return func;
    }
    function wrappedFunction() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var event = tracer_1.tracer.functionStart(fileName, functionName);
        // @ts-ignore
        var result = func.call.apply(func, __spread([this], args));
        if (utils_1.isPromise(result)) {
            return result.then(function (resolvedResult) {
                tracer_1.tracer.functionEnd(event);
                return resolvedResult;
            });
        }
        tracer_1.tracer.functionEnd(event);
        return result;
    }
    // @ts-ignore
    wrappedFunction.recapDevWrapped = true;
    return wrappedFunction;
}
exports.wrapFunction = wrapFunction;
/**
 * Wraps a class with recap.dev tracing.
 * This will record all the method calls and add them to a current trace.
 * @param {string} fileName - Name of the file where function is declared.
 * @param {string} className - Name of the class.
 * @param {function} cls - The class to wrap.
 * @param {boolean} moveMetadata - Defines if the metadata will be moved to the wrapped method
 */
exports.wrapClass = function (fileName, className, cls, moveMetadata) {
    var e_1, _a;
    if (moveMetadata === void 0) { moveMetadata = false; }
    var _loop_1 = function (methodName) {
        var originalMethod = cls.prototype[methodName];
        if (lodash_es_1.isFunction(originalMethod) && methodName !== 'constructor') {
            var wrappedMethod_1 = wrapFunction(fileName, className + "." + methodName, cls.prototype[methodName]);
            if (moveMetadata) {
                Reflect.getMetadataKeys(originalMethod).forEach(function (key) {
                    var metadata = Reflect.getMetadata(key, originalMethod);
                    Reflect.defineMetadata(key, metadata, wrappedMethod_1);
                    Reflect.deleteMetadata(key, originalMethod);
                });
            }
            cls.prototype[methodName] = wrappedMethod_1;
        }
    };
    try {
        // TODO: figure out how to use variable name instead of a class name
        for (var _b = __values(Object.getOwnPropertyNames(cls.prototype)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var methodName = _c.value;
            _loop_1(methodName);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
};
//# sourceMappingURL=common.js.map