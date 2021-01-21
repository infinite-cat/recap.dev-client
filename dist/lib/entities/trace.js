"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Trace = /** @class */ (function () {
    function Trace(id, unitName, unitType) {
        this.logs = [];
        this.appName = process.env.RECAP_DEV_APP_NAME;
        this.status = 'OK';
        this.functionCallEvents = [];
        this.resourceAccessEvents = [];
        this.extraData = {};
        this.id = id;
        this.unitName = unitName;
        this.unitType = unitType;
    }
    return Trace;
}());
exports.Trace = Trace;
//# sourceMappingURL=trace.js.map