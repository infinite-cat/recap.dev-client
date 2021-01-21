"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_es_1 = require("lodash-es");
exports.isPromise = function (value) { return (value
    && lodash_es_1.isFunction(value.then)
    && Object.prototype.toString.call(value) === '[object Promise]'); };
//# sourceMappingURL=utils.js.map