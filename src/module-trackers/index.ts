import awsSdkTracker from './aws-sdk'
import { trackMysql } from './mysql'
import { trackPostgres } from './postgres'
import { trackElasticsearch } from './elasticsearch'

export const trackModules = () => {
  console.time('aws sdk tracing')
  awsSdkTracker.init()
  console.timeEnd('aws sdk tracing')
  console.time('mysql tracing')
  trackMysql()
  console.timeEnd('mysql tracing')
  console.time('postgres tracing')
  trackPostgres()
  console.timeEnd('postgres tracing')
  trackElasticsearch()
}
