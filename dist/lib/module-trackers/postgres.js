"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var sql_1 = require("./sql");
var utils_1 = require("./utils");
var config_1 = require("../config");
function pgClientWrapper(wrappedFunction) {
    return function internalPgClientWrapper(queryString, arg1, arg2) {
        if (queryString && queryString.submit) {
            return wrappedFunction.apply(this, [queryString, arg1, arg2]);
        }
        var parseResult = sql_1.parseQueryArgs(arg1, arg2);
        var params = parseResult.params;
        var callback = parseResult.callback;
        var sqlString = queryString;
        var sqlParams = params;
        if (queryString && queryString.text) {
            sqlString = queryString.text;
            if (queryString.values && params && !params.length) {
                params = undefined;
                sqlParams = queryString.values;
            }
        }
        var patchedCallback = sql_1.wrapSqlQuery(sqlString, sqlParams, callback, this.connectionParameters || this._clients[0], // eslint-disable-line
        'PostgreSQL');
        if (callback) {
            return wrappedFunction.apply(this, [queryString, params, patchedCallback]);
        }
        patchedCallback = patchedCallback || (function () { });
        var responsePromise = wrappedFunction.apply(this, [queryString, params]);
        if (!(responsePromise && typeof responsePromise.then === 'function')) {
            patchedCallback(null, null, null);
        }
        return responsePromise.then(function (res) {
            patchedCallback(null, res, null);
            return res;
        }, function (err) {
            patchedCallback(err, null, null);
            throw err;
        });
    };
}
exports.trackPostgres = function () {
    utils_1.patchModule(config_1.config.pgDriverModulePath, 'query', pgClientWrapper, function (pg) { return pg.Client.prototype; });
    utils_1.patchModule('pg-pool', 'query', pgClientWrapper, function (Pool) { return Pool.prototype; });
};
//# sourceMappingURL=postgres.js.map