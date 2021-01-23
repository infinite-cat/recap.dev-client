"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var async_hooks_1 = require("async_hooks");
var AsyncHooksTraceStore = /** @class */ (function () {
    function AsyncHooksTraceStore() {
        var _this = this;
        this.traceMap = new Map();
        this.hook = async_hooks_1.createHook({
            init: function (asyncId, type, parentAsyncId) {
                var parentTrace = _this.traceMap.get(parentAsyncId);
                if (parentTrace) {
                    _this.traceMap.set(asyncId, parentTrace);
                }
            },
            destroy: function (asyncId) {
                _this.traceMap.delete(asyncId);
            },
            promiseResolve: function (asyncId) {
                var currentTrace = _this.traceMap.get(async_hooks_1.executionAsyncId());
                if (currentTrace) {
                    _this.traceMap.set(asyncId, currentTrace);
                }
            },
        });
        this.hook.enable();
    }
    AsyncHooksTraceStore.prototype.startNewTrace = function (trace) {
        this.traceMap.set(async_hooks_1.executionAsyncId(), trace);
        return trace;
    };
    AsyncHooksTraceStore.prototype.getCurrentTrace = function () {
        return this.traceMap.get(async_hooks_1.executionAsyncId());
    };
    AsyncHooksTraceStore.prototype.associateAsyncId = function (parentAsyncId) {
        var parentTrace = this.traceMap.get(parentAsyncId);
        if (!parentTrace) {
            return;
        }
        this.traceMap.set(async_hooks_1.executionAsyncId(), parentTrace);
    };
    return AsyncHooksTraceStore;
}());
exports.AsyncHooksTraceStore = AsyncHooksTraceStore;
//# sourceMappingURL=async-hooks-trace-store.js.map