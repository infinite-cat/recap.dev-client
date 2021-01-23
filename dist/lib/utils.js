"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_es_1 = require("lodash-es");
var config_1 = require("./config");
exports.isPromise = function (value) { return (value
    && lodash_es_1.isFunction(value.then)
    && Object.prototype.toString.call(value) === '[object Promise]'); };
exports.safeParse = function (parseString) {
    try {
        return JSON.parse(parseString);
    }
    catch (e) {
        return null;
    }
};
exports.appendBodyChunk = function (chunk, body) {
    if (chunk && body.length < config_1.config.maxPayloadLength) {
        return body + chunk;
    }
    return body;
};
//# sourceMappingURL=utils.js.map