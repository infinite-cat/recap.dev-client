"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable camelcase,no-undef,import/no-extraneous-dependencies,global-require */
var shimmer_1 = __importDefault(require("shimmer"));
var serialize_error_1 = require("serialize-error");
var lastError = null;
exports.tryRequire = function (id) {
    // hack for webpack
    try {
        if (id === 'pg') {
            // @ts-ignore
            return require('pg');
        }
        if (id === 'pg-pool') {
            // @ts-ignore
            return require('pg-pool');
        }
        if (id === 'mysql/lib/Connection.js') {
            // @ts-ignore
            return require('mysql/lib/Connection.js');
        }
        if (id === '@elastic/elasticsearch') {
            // @ts-ignore
            return require('@elastic/elasticsearch');
        }
        if (id === 'mongodb') {
            // @ts-ignore
            return require('mongodb');
        }
    }
    catch (e) {
        lastError = e;
    }
    // @ts-ignore
    var isWebpack = typeof __webpack_require__ === 'function';
    // @ts-ignore
    var currentRequire = isWebpack ? __non_webpack_require__ : require;
    try {
        return currentRequire(id);
    }
    catch (e) {
        lastError = e;
    }
    return undefined;
};
exports.tryRequire.lastError = function () { return lastError; };
exports.getModules = function getModules(id) {
    var modules = [];
    if (typeof require.resolve.paths !== 'function') {
        var module_1 = exports.tryRequire(id);
        if (module_1) {
            modules.push(module_1);
        }
        return modules;
    }
    var searchPaths = require.resolve.paths(id);
    searchPaths.forEach(function (path) {
        var module = exports.tryRequire(path + "/" + id);
        if (module) {
            modules.push(module);
        }
    });
    return modules;
};
exports.patchModule = function patchModule(id, methodName, wrapper, memberExtractor) {
    if (memberExtractor === void 0) { memberExtractor = function (mod) { return mod; }; }
    var modules = exports.getModules(id);
    modules.forEach(function (module) {
        var _a;
        if (!((_a = memberExtractor(module)) === null || _a === void 0 ? void 0 : _a.recapDevWrapped)) {
            shimmer_1.default.wrap(memberExtractor(module), methodName, wrapper);
        }
    });
};
exports.serializeError = function (err) {
    if (!err) {
        return undefined;
    }
    return JSON.stringify(serialize_error_1.serializeError(err));
};
//# sourceMappingURL=utils.js.map