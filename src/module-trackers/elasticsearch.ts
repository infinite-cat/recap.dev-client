import { patchModule } from './utils'
import { resourceAccessStart } from '../client'
import { serializeError } from 'serialize-error'

function elasticSearchWrapper(wrappedFunction) {
  return function internalPgClientWrapper(params, options, callback) {
    console.log('es called')
    const event = resourceAccessStart('elasticsearch', params.path, {
      request: {
        method: params.method,
        body: params.body,
        bulkBody: params.bulkBody,
        queryString: params.querystring
      }
    })

    const patchedCallback = (err, result) => {
      event.end = Date.now()

      if (err) {
        event.error = JSON.stringify(serializeError(err))
        event.status = 'ERROR'
      } else {
        event.status = 'OK'
      }

      if (result) {
        event.response.statusCode = result.statusCode
        event.response.body = result.body
      }

      if (callback) {
        callback(err, result)
      }

      if (err) {
        throw err
      }

      return result
    }

    return wrappedFunction.apply(this, [params, options, patchedCallback])
  }
}

export const trackElasticsearch = () => {
  patchModule(
    '@elastic/elasticsearch',
    'request',
    elasticSearchWrapper,
    es => es.Transport.prototype
  )
}
