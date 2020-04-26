import { isArray } from 'lodash-es'
import { serializeError } from 'serialize-error'
import { resourceAccessStart } from '../client'

const MAX_QUERY_SIZE = 2048
const MAX_PARAMS_LENGTH = 5

export const parseQueryArgs = function parseQueryArgs(arg1, arg2) {
  const paramNotSet = arg2 === undefined && arg1 instanceof Function
  const callback = paramNotSet ? arg1 : arg2
  const params = paramNotSet ? [] : arg1

  return { params, callback }
}

export const wrapSqlQuery = function wrapSqlQuery(queryString, params, callback, config, driver) {
  let patchedCallback
  let event
  try {
    const { database, host } = config

    let serviceName = 'sql'
    if (host.match('.rds.')) {
      serviceName = 'rds'
    }
    if (host.match('.redshift.')) {
      serviceName = 'redshift'
    }

    event = resourceAccessStart(serviceName, host, {
      database,
      driver,
      request: {
        query: queryString.substring(0, MAX_QUERY_SIZE),
        parameters: isArray(params) ? params.slice(0, MAX_PARAMS_LENGTH) : undefined
      }
    })

    event.request.operation = 'query'

    patchedCallback = (err, res, fields) => {
      const endTime = Date.now()
      let rowCount: number | undefined

      if (!err) {
        rowCount = res.rowCount
        if (!rowCount && isArray(res)) {
          rowCount = res.length
        }
      }

      event.end = endTime
      event.status = err ? 'ERROR' : 'OK'
      event.response.rowCount = rowCount
      event.error = JSON.stringify(serializeError(err))

      if (callback) {
        callback(err, res, fields)
      }
    }
  } catch (e) {
    if (event) {
      event.end = Date.now()
      event.error = JSON.stringify(serializeError(e))
      event.status = 'ERROR'
    }
  }

  return patchedCallback || callback
}
