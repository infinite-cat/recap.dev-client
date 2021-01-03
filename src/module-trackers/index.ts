import awsSdkTracker from './aws-sdk'
import { trackMysql } from './mysql'
import { trackPostgres } from './postgres'
import { trackElasticsearch } from './elasticsearch'
import { trackHttp } from './http/http'
import { trackHttp2 } from './http/http2'
import { trackMongoDb } from './mongodb'

export const trackModules = () => {
  awsSdkTracker.init()
  trackMysql()
  trackPostgres()
  trackMongoDb()
  trackElasticsearch()
  trackHttp()
  trackHttp2()
}
