"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var sql_1 = require("./sql");
function mysqlQueryWrapper(wrappedFunction) {
    var internalMySqlQueryWrapper = function internalMySqlQueryWrapper(sql, arg1, arg2) {
        var _a;
        var queryString;
        var callback;
        var params;
        var overrideInnerCallback = false;
        if (typeof sql !== 'string') {
            queryString = sql.sql;
        }
        else {
            queryString = sql;
        }
        if (sql.onResult) {
            params = sql.values;
            callback = sql.onResult;
        }
        else {
            (_a = sql_1.parseQueryArgs(arg1, arg2), params = _a.params, callback = _a.callback);
        }
        // eslint-disable-next-line no-underscore-dangle
        if (callback === undefined && sql._callback) {
            callback = sql._callback; // eslint-disable-line no-underscore-dangle
            overrideInnerCallback = true;
        }
        var patchedCallback = sql_1.wrapSqlQuery(queryString, params, callback, this.config, 'MySQL');
        if (sql.onResult) {
            sql.onResult = patchedCallback;
        }
        else {
            callback = patchedCallback;
        }
        if (overrideInnerCallback) {
            // eslint-disable-next-line no-underscore-dangle
            sql._callback = patchedCallback;
        }
        return wrappedFunction.apply(this, [sql, params, callback]);
    };
    // @ts-ignore
    internalMySqlQueryWrapper.recapDevWrapped = true;
    return internalMySqlQueryWrapper;
}
exports.trackMysql = function () {
    utils_1.patchModule('mysql2', 'query', mysqlQueryWrapper, function (mysql2) { return mysql2.Connection.prototype; });
    utils_1.patchModule('mysql2', 'execute', mysqlQueryWrapper, function (mysql2) { return mysql2.Connection.prototype; });
    utils_1.patchModule('mysql/lib/Connection.js', 'query', mysqlQueryWrapper, function (mysqlConnection) { return mysqlConnection.prototype; });
};
//# sourceMappingURL=mysql.js.map