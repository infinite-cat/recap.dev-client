import { isArray, isEmpty, get } from 'lodash-es'

import { debugLog } from '../log'
import { serializeError } from './utils'
import { tracer } from '../tracer'

// @ts-ignore
const mysqlParser = require('node-sql-parser/build/mysql')
// @ts-ignore
const postgresParser = require('node-sql-parser/build/postgresql')

const MAX_QUERY_SIZE = 2048
const MAX_PARAMS_LENGTH = 5

const parsers = {
  'MySQL': mysqlParser,
  'PostgresQL': postgresParser,
}

export const parseQueryArgs = function parseQueryArgs(arg1, arg2) {
  const paramNotSet = arg2 === undefined && arg1 instanceof Function
  const callback = paramNotSet ? arg1 : arg2
  const params = paramNotSet ? [] : arg1

  return { params, callback }
}

export const extractSqlInformation = (query: string, driver: string) => {
  try {


    const parser = new parsers[driver].Parser()
    const { tableList } = parser.parse(query, { database: driver })
    if (!isEmpty(tableList)) {
      const [operation, dbName, tableName] = tableList[0].split('::')
      return { operation, dbName, tableName }
    }
  } catch (e) {
    debugLog(`Failed to parse sql query: ${query}`, e)
  }
  return null
}

export const wrapSqlQuery = function wrapSqlQuery(queryString, params, callback, config, driver) {
  let patchedCallback
  let event
  try {
    const { database, host } = config

    const resourceIdentifier: any = {
      host,
    }

    const sqlData = extractSqlInformation(queryString, driver)

    if (sqlData) {
      resourceIdentifier.tableName = sqlData.tableName
    }

    let serviceName = 'sql'
    if (host.match('.rds.')) {
      serviceName = 'rds'
    }
    if (host.match('.redshift.')) {
      serviceName = 'redshift'
    }

    event = tracer.resourceAccessStart(serviceName, resourceIdentifier, {
      database,
      driver,
      request: {
        query: queryString.substring(0, MAX_QUERY_SIZE),
        parameters: isArray(params) ? params.slice(0, MAX_PARAMS_LENGTH) : undefined,
      },
    })

    event.request.operation = get(sqlData, 'operation', 'query')

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
      event.error = serializeError(err)

      if (callback) {
        callback(err, res, fields)
      }
    }
  } catch (e) {
    if (event) {
      event.end = Date.now()
      event.error = serializeError(e)
      event.status = 'ERROR'
    }
  }

  return patchedCallback || callback
}
