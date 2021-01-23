"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_es_1 = require("lodash-es");
var utils_1 = require("./utils");
var tracer_1 = require("../tracer");
var logResult = function (result, event) {
    event.end = Date.now();
    event.status = 'OK';
    event.response.statusCode = result.statusCode;
    event.response.body = lodash_es_1.cloneDeep(result.body);
    if (lodash_es_1.get(result, 'body.hits.hits')) {
        event.response.body.hits.hits = result.body.hits.hits.length;
    }
    return result;
};
var logError = function (err, event) {
    event.end = Date.now();
    event.error = utils_1.serializeError(err);
    event.status = 'ERROR';
    throw err;
};
function elasticSearchWrapper(wrappedFunction) {
    function internalEsClientWrapper(params, options, callback) {
        if (callback) {
            var event_1 = tracer_1.tracer.resourceAccessStart('elasticsearch', { path: params.path }, {
                request: {
                    method: params.method,
                    body: params.body,
                    bulkBody: params.bulkBody,
                    queryString: params.querystring,
                    operation: params.method,
                },
            });
            var patchedCallback = function (err, result) {
                if (err) {
                    logError(err, event_1);
                }
                else {
                    logResult(result, event_1);
                }
                callback(err, result);
            };
            return wrappedFunction.apply(this, [params, options, patchedCallback]);
        }
        return wrappedFunction.apply(this, [params, options]);
    }
    internalEsClientWrapper.recapDevWrapped = true;
    return internalEsClientWrapper;
}
exports.trackElasticsearch = function () {
    utils_1.patchModule('@elastic/elasticsearch', 'request', elasticSearchWrapper, function (es) { return es.Transport.prototype; });
};
//# sourceMappingURL=elasticsearch.js.map