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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_es_1 = require("lodash-es");
var node_sql_parser_1 = __importDefault(require("node-sql-parser"));
var log_1 = require("../log");
var utils_1 = require("./utils");
var tracer_1 = require("../tracer");
var MAX_QUERY_SIZE = 2048;
var MAX_PARAMS_LENGTH = 5;
exports.parseQueryArgs = function parseQueryArgs(arg1, arg2) {
    var paramNotSet = arg2 === undefined && arg1 instanceof Function;
    var callback = paramNotSet ? arg1 : arg2;
    var params = paramNotSet ? [] : arg1;
    return { params: params, callback: callback };
};
exports.extractSqlInformation = function (query, driver) {
    try {
        var parser = new node_sql_parser_1.default.Parser();
        var tableList = parser.parse(query, { database: driver }).tableList;
        if (!lodash_es_1.isEmpty(tableList)) {
            var _a = __read(tableList[0].split('::'), 3), operation = _a[0], dbName = _a[1], tableName = _a[2];
            return { operation: operation, dbName: dbName, tableName: tableName };
        }
    }
    catch (e) {
        log_1.debugLog("Failed to parse sql query: " + query, e);
    }
    return null;
};
exports.wrapSqlQuery = function wrapSqlQuery(queryString, params, callback, config, driver) {
    var patchedCallback;
    var event;
    try {
        var database = config.database, host = config.host;
        var resourceIdentifier = {
            host: host,
        };
        var sqlData = exports.extractSqlInformation(queryString, driver);
        if (sqlData) {
            resourceIdentifier.tableName = sqlData.tableName;
        }
        var serviceName = 'sql';
        if (host.match('.rds.')) {
            serviceName = 'rds';
        }
        if (host.match('.redshift.')) {
            serviceName = 'redshift';
        }
        event = tracer_1.tracer.resourceAccessStart(serviceName, resourceIdentifier, {
            database: database,
            driver: driver,
            request: {
                query: queryString.substring(0, MAX_QUERY_SIZE),
                parameters: lodash_es_1.isArray(params) ? params.slice(0, MAX_PARAMS_LENGTH) : undefined,
            },
        });
        event.request.operation = lodash_es_1.get(sqlData, 'operation', 'query');
        patchedCallback = function (err, res, fields) {
            var endTime = Date.now();
            var rowCount;
            if (!err) {
                rowCount = res.rowCount;
                if (!rowCount && lodash_es_1.isArray(res)) {
                    rowCount = res.length;
                }
            }
            event.end = endTime;
            event.status = err ? 'ERROR' : 'OK';
            event.response.rowCount = rowCount;
            event.error = utils_1.serializeError(err);
            if (callback) {
                callback(err, res, fields);
            }
        };
    }
    catch (e) {
        if (event) {
            event.end = Date.now();
            event.error = utils_1.serializeError(e);
            event.status = 'ERROR';
        }
    }
    return patchedCallback || callback;
};
//# sourceMappingURL=sql.js.map