"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
var common_1 = require("./common");
/**
 * Wraps a NestJS module with recap.dev tracing
 * This will record all the method calls and add them to a current trace.
 * @param {object} module - NestJS module to wrap
 * @returns {Function} NestJS module
 */
exports.wrapNestJsModule = function (module) {
    Reflect.getMetadata('controllers', module).forEach(function (injectable) {
        common_1.wrapClass('', injectable.name, injectable, true);
    });
    Reflect.getMetadata('providers', module).forEach(function (injectable) { return common_1.wrapClass('', injectable.name, injectable, true); });
    return module;
};
//# sourceMappingURL=nestjs.js.map