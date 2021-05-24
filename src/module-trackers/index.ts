import awsSdkTracker from './aws-sdk'
import { trackMysql } from './mysql'
import { trackPostgres } from './postgres'
import { trackElasticsearch } from './elasticsearch'
import { trackHttp } from './http/http'
import { trackHttp2 } from './http/http2'
import { trackMongoDb } from './mongodb'
import { config } from '../config'

export const trackModules = () => {
  if (config.disableResourceCapture) {
    return
  }

  awsSdkTracker.init()
  trackMysql()
  trackPostgres()
  trackMongoDb()
  trackElasticsearch()
  trackHttp()
  trackHttp2()
}
