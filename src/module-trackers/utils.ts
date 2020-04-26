/* eslint-disable camelcase,no-undef,import/no-extraneous-dependencies,global-require */
import shimmer from 'shimmer'

let lastError: null | Error = null

export const tryRequire: any = (id: string) => {
  // hack for webpack
  try {
    if (id === 'pg') {
      // @ts-ignore
      return require('pg')
    }

    if (id === 'pg-pool') {
      // @ts-ignore
      return require('pg-pool')
    }

    if (id === 'mysql/lib/Connection.js') {
      // @ts-ignore
      return require('mysql/lib/Connection.js')
    }

    if (id === '@elastic/elasticsearch') {
      // @ts-ignore
      return require('@elastic/elasticsearch')
    }
  } catch (e) {
    lastError = e
  }

  // @ts-ignore
  const isWebpack = typeof __webpack_require__ === 'function'
  // @ts-ignore
  const currentRequire = isWebpack ? __non_webpack_require__ : require

  try {
    return currentRequire(id)
  } catch (e) {
    lastError = e
  }

  return undefined
}

tryRequire.lastError = () => lastError

export const getModules = function getModules(id: string) {
  const modules: any[] = []
  if (typeof require.resolve.paths !== 'function') {
    const module = tryRequire(id)

    if (module) {
      modules.push(module)
    }
    return modules
  }

  const searchPaths: any[] = require.resolve.paths(id)!

  searchPaths.forEach((path) => {
    const module = tryRequire(`${path}/${id}`) as any
    if (module) {
      modules.push(module)
    }
  })

  return modules
}

export const patchModule = function patchModule(
  id: string,
  methodName: string,
  wrapper: any,
  memberExtractor = (mod: any) => mod,
) {
  const modules = getModules(id)
  modules.forEach((module: any) => {
    if (!memberExtractor(module).tracemanWrapped) {
      shimmer.wrap(memberExtractor(module), methodName, wrapper)
    }
  })
}
