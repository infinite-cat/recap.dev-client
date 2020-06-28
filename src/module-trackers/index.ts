import awsSdkTracker from './aws-sdk'
import { trackMysql } from './mysql'
import { trackPostgres } from './postgres'
import { trackElasticsearch } from './elasticsearch'
import { trackHttp } from './http/http'
import { trackHttp2 } from './http/http2'

export const trackModules = () => {
  awsSdkTracker.init()
  trackMysql()
  trackPostgres()
  trackElasticsearch()
  trackHttp()
  trackHttp2()
}
