"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var aws_sdk_1 = __importDefault(require("./aws-sdk"));
var mysql_1 = require("./mysql");
var postgres_1 = require("./postgres");
var elasticsearch_1 = require("./elasticsearch");
var http_1 = require("./http/http");
var http2_1 = require("./http/http2");
var mongodb_1 = require("./mongodb");
exports.trackModules = function () {
    aws_sdk_1.default.init();
    mysql_1.trackMysql();
    postgres_1.trackPostgres();
    mongodb_1.trackMongoDb();
    elasticsearch_1.trackElasticsearch();
    http_1.trackHttp();
    http2_1.trackHttp2();
};
//# sourceMappingURL=index.js.map