import { cloneDeep, get } from 'lodash-es'

import { patchModule, serializeError } from './utils'
import { tracer } from '../tracer'

const logResult = (result, event) => {
  event.end = Date.now()
  event.status = 'OK'
  event.response.statusCode = result.statusCode
  event.response.body = cloneDeep(result.body)

  if (get(result, 'body.hits.hits')) {
    event.response.body.hits.hits = result.body.hits.hits.length
  }

  return result
}

const logError = (err, event) => {
  event.end = Date.now()
  event.error = serializeError(err)
  event.status = 'ERROR'

  throw err
}

function elasticSearchWrapper(wrappedFunction) {
  function internalEsClientWrapper(params, options, callback) {
    if (callback) {
      const event = tracer.resourceAccessStart(
        'elasticsearch',
        { path: params.path },
        {
          request: {
            method: params.method,
            body: params.body,
            bulkBody: params.bulkBody,
            queryString: params.querystring,
            operation: params.method,
          },
        },
      )

      const patchedCallback = (err, result) => {
        if (err) {
          logError(err, event)
        } else {
          logResult(result, event)
        }

        callback(err, result)
      }

      return wrappedFunction.apply(this, [params, options, patchedCallback])
    }

    return wrappedFunction.apply(this, [params, options])
  }

  internalEsClientWrapper.recapDevWrapped = true

  return internalEsClientWrapper
}

export const trackElasticsearch = () => {
  patchModule(
    '@elastic/elasticsearch',
    'request',
    elasticSearchWrapper,
    (es) => es.Transport.prototype,
  )
}
