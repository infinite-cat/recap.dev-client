import awsSdkTracker from './aws-sdk'
import { trackMysql } from './mysql'
import { trackPostgres } from './postgres'
import { trackElasticsearch } from './elasticsearch'

export const trackModules = () => {
  awsSdkTracker.init()
  trackMysql()
  trackPostgres()
  trackElasticsearch()
}
