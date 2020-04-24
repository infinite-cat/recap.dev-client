import { patchModule } from './utils'
import { parseQueryArgs, wrapSqlQuery } from './sql'

function mysqlQueryWrapper(wrappedFunction) {
  let internalMySqlQueryWrapper = function internalMySqlQueryWrapper(sql, arg1, arg2) {
    let queryString
    let callback
    let params
    let overrideInnerCallback = false
    if (typeof sql !== 'string') {
      queryString = sql.sql
    } else {
      queryString = sql
    }

    if (sql.onResult) {
      params = sql.values
      callback = sql.onResult
    } else {
      ;({ params, callback } = parseQueryArgs(arg1, arg2))
    }

    if (callback === undefined && sql._callback) {
      // eslint-disable-line no-underscore-dangle
      // In pool connection, no callback passed, but _callback is being used.
      callback = sql._callback // eslint-disable-line no-underscore-dangle
      overrideInnerCallback = true
    }

    const patchedCallback = wrapSqlQuery(queryString, params, callback, this.config, 'mysql')
    if (sql.onResult) {
      sql.onResult = patchedCallback
    } else {
      callback = patchedCallback
    }
    if (overrideInnerCallback) {
      sql._callback = patchedCallback
    }
    return wrappedFunction.apply(this, [sql, params, callback])
  }

  // @ts-ignore
  internalMySqlQueryWrapper.autotracerWrapped = true

  return internalMySqlQueryWrapper
}

export const trackMysql = () => {
  patchModule('mysql2', 'query', mysqlQueryWrapper, mysql2 => mysql2.Connection.prototype)

  patchModule('mysql2', 'execute', mysqlQueryWrapper, mysql2 => mysql2.Connection.prototype)

  patchModule(
    'mysql/lib/Connection.js',
    'query',
    mysqlQueryWrapper,
    mysqlConnection => mysqlConnection.prototype
  )
}
