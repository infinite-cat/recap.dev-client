"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var SimpleTraceStore = /** @class */ (function () {
    function SimpleTraceStore() {
    }
    SimpleTraceStore.prototype.startNewTrace = function (trace) {
        this.currentTrace = trace;
        return this.currentTrace;
    };
    SimpleTraceStore.prototype.getCurrentTrace = function () {
        return this.currentTrace;
    };
    SimpleTraceStore.prototype.associateAsyncId = function (_) {
        throw new Error('Current trace store doesn\t support async hooks. Try setting a supported trace store, for example tracer.setTraceStore(new AsyncHooksTraceStore())');
    };
    return SimpleTraceStore;
}());
exports.SimpleTraceStore = SimpleTraceStore;
//# sourceMappingURL=simple-trace-store.js.map