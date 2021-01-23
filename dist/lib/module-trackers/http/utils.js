"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var zlib_1 = __importDefault(require("zlib"));
var url_1 = __importDefault(require("url"));
var log_1 = require("../../log");
exports.extractHostname = function (url) {
    if (!url) {
        return 'unknown';
    }
    var parsedUrl = url_1.default.parse(url);
    return (parsedUrl && parsedUrl.hostname)
        || (parsedUrl && parsedUrl.host);
};
var isUrlBlacklisted = function (host, path) {
    var _a;
    var syncEndpointHost = exports.extractHostname(process.env.RECAP_DEV_SYNC_ENDPOINT);
    var urlBlacklistMap = (_a = {},
        _a[syncEndpointHost] = 'endsWith',
        _a['oauth2.googleapis.com'] = 'endsWith',
        _a['amazonaws.com'] = function (url, pattern) { return url.endsWith(pattern)
            && (url.indexOf('.execute-api.') === -1)
            && (url.indexOf('.es.') === -1)
            && (url.indexOf('.elb.') === -1)
            && (url.indexOf('.appsync-api.') === -1); },
        _a['blob.core.windows.net'] = 'endsWith',
        _a['documents.azure.com'] = 'endsWith',
        _a['127.0.0.1'] = function (url, pattern, urlPath) { return (url === pattern) && urlPath.startsWith('/2018-06-01/runtime/invocation/'); },
        _a['169.254.169.254'] = 'startsWith',
        _a);
    return Object.keys(urlBlacklistMap).some(function (key) {
        if (typeof urlBlacklistMap[key] === typeof (function () { })) {
            return urlBlacklistMap[key](host, key, path);
        }
        return host[urlBlacklistMap[key]](key);
    });
};
var isUrlIgnoredByUser = function (host) {
    var ignorePatterns = (process.env.RECAP_DEV_IGNORE_HTTP_PATTERNS && process.env.RECAP_DEV_IGNORE_HTTP_PATTERNS.split(',')) || [];
    return ignorePatterns.some(function (pattern) { return host.includes(pattern); });
};
exports.isUrlIgnored = function (host, path) { return isUrlBlacklisted(host, path) || isUrlIgnoredByUser(host); };
var ENCODING_FUNCTIONS = {
    // @ts-ignore
    br: zlib_1.default.brotliDecompressSync,
    // @ts-ignore
    brotli: zlib_1.default.brotliDecompressSync,
    gzip: zlib_1.default.gunzipSync,
    deflate: zlib_1.default.deflateSync,
};
exports.decodeJson = function (data, encoding) {
    try {
        var jsonData = data;
        if (ENCODING_FUNCTIONS[encoding]) {
            try {
                jsonData = ENCODING_FUNCTIONS[encoding](data);
            }
            catch (err) {
                log_1.debugLog('Could not decode JSON');
            }
        }
        JSON.parse(jsonData);
        return jsonData.toString();
    }
    catch (err) {
        log_1.debugLog('Could not parse JSON', err);
    }
    return undefined;
};
var maxHttpValueSize = 10 * 1024;
exports.addChunk = function (chunk, chunks) {
    if (chunk) {
        var totalSize = chunks.reduce(function (total, item) { return item.length + total; }, 0);
        if (totalSize + chunk.length <= maxHttpValueSize) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
    }
};
//# sourceMappingURL=utils.js.map