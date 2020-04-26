import { parseQueryArgs, wrapSqlQuery } from './sql'
import { patchModule } from './utils'

const pgPath = process.env.TRACEMAN_POSTGRES_MODULE
  ? `${process.cwd()}${process.env.TRACEMAN_POSTGRES_MODULE}`
  : 'pg'

function pgClientWrapper(wrappedFunction) {
  return function internalPgClientWrapper(queryString, arg1, arg2) {
    if (queryString && queryString.submit) {
      return wrappedFunction.apply(this, [queryString, arg1, arg2])
    }

    const parseResult = parseQueryArgs(arg1, arg2)
    let { params } = parseResult
    const { callback } = parseResult

    let sqlString = queryString
    let sqlParams = params
    if (queryString && queryString.text) {
      sqlString = queryString.text
      if (queryString.values && params && !params.length) {
        params = undefined
        sqlParams = queryString.values
      }
    }

    let patchedCallback = wrapSqlQuery(
      sqlString,
      sqlParams,
      callback,
      this.connectionParameters || this._clients[0], // eslint-disable-line
      'pg'
    )

    if (callback) {
      return wrappedFunction.apply(this, [queryString, params, patchedCallback])
    }

    patchedCallback = patchedCallback || (() => {})
    const responsePromise = wrappedFunction.apply(this, [queryString, params])

    if (!(responsePromise && typeof responsePromise.then === 'function')) {
      patchedCallback(null, null, null)
    }

    return responsePromise.then(
      res => {
        patchedCallback(null, res, null)
        return res
      },
      err => {
        patchedCallback(err, null, null)
        throw err
      }
    )
  }
}

export const trackPostgres = () => {
  patchModule(pgPath, 'query', pgClientWrapper, pg => pg.Client.prototype)

  patchModule('pg-pool', 'query', pgClientWrapper, Pool => Pool.prototype)
}
