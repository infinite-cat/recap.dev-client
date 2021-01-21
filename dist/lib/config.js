"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Config = /** @class */ (function () {
    function Config() {
    }
    Object.defineProperty(Config.prototype, "disablePayloadCapture", {
        get: function () {
            return (process.env.RECAP_DEV_DISABLE_PAYLOAD_CAPTURE && Boolean(process.env.RECAP_DEV_DISABLE_PAYLOAD_CAPTURE)) || false;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config.prototype, "syncTimeout", {
        get: function () {
            return process.env.RECAP_DEV_SYNC_TIMEOUT ? Number(process.env.RECAP_DEV_SYNC_TIMEOUT) : 1000;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config.prototype, "syncEndpoint", {
        get: function () {
            return process.env.RECAP_DEV_SYNC_ENDPOINT;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config.prototype, "serverlessTimeoutWindow", {
        get: function () {
            return process.env.RECAP_DEV_TIMEOUT_WINDOW ? Number(process.env.RECAP_DEV_TIMEOUT_WINDOW) : 200;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config.prototype, "pgDriverModulePath", {
        get: function () {
            return process.env.RECAP_DEV_POSTGRES_MODULE ? "" + process.cwd() + process.env.RECAP_DEV_POSTGRES_MODULE : 'pg';
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config.prototype, "isDebugLogEnabled", {
        get: function () {
            return !!process.env.RECAP_DEV_DEBUG_LOG;
        },
        enumerable: true,
        configurable: true
    });
    return Config;
}());
exports.config = new Config();
//# sourceMappingURL=config.js.map