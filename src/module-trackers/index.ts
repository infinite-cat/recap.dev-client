import awsSdkV3Tracker from "./aws-sdk-v3"
import { trackMysql } from './mysql'
import { trackPostgres } from './postgres'
import { trackElasticsearch } from './elasticsearch'
import { trackHttp } from './http/http'
import { trackHttp2 } from './http/http2'
import { trackMongoDb } from './mongodb'
import { config } from '../config'

export { mysqlQueryWrapper } from './mysql'

export const trackModules = () => {
  try {
    if (config.disableResourceCapture) {
      return
    }

    awsSdkV3Tracker.init()
    trackMysql()
    trackPostgres()
    trackMongoDb()
    trackElasticsearch()
    trackHttp()
    trackHttp2()
  } catch (e) {
    if (config.isDebugLogEnabled) {
      console.log('Error setting up recap.dev tracing: ', e)
    }
  }
}
