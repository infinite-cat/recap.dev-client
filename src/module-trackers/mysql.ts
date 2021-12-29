import { patchModule } from './utils'
import { parseQueryArgs, wrapSqlQuery } from './sql'

function mysqlQueryWrapper(wrappedFunction) {
  const internalMySqlQueryWrapper = function internalMySqlQueryWrapper(sql, arg1, arg2) {
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
      const queryArgs = parseQueryArgs(arg1, arg2)
      params = queryArgs.params
      callback = queryArgs.callback
    }

    // eslint-disable-next-line no-underscore-dangle
    if (callback === undefined && sql._callback) {
      callback = sql._callback // eslint-disable-line no-underscore-dangle
      overrideInnerCallback = true
    }

    const patchedCallback = wrapSqlQuery(queryString, params, callback, this.config, 'MySQL')
    if (sql.onResult) {
      sql.onResult = patchedCallback
    } else {
      callback = patchedCallback
    }
    if (overrideInnerCallback) {
      // eslint-disable-next-line no-underscore-dangle
      sql._callback = patchedCallback
    }
    return wrappedFunction.apply(this, [sql, params, callback])
  }

  // @ts-ignore
  internalMySqlQueryWrapper.recapDevWrapped = true

  return internalMySqlQueryWrapper
}

export const trackMysql = () => {
  patchModule('mysql2', 'query', mysqlQueryWrapper, (mysql2) => mysql2?.Connection?.prototype)

  patchModule('mysql2', 'execute', mysqlQueryWrapper, (mysql2) => mysql2?.Connection?.prototype)

  patchModule(
    'mysql/lib/Connection.js',
    'query',
    mysqlQueryWrapper,
    (mysqlConnection) => mysqlConnection?.prototype,
  )
}
