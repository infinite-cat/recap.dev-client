import http from 'http'
import https from 'https'
import urlLib from 'url'
import shimmer from 'shimmer'

import { addChunk, decodeJson, isUrlIgnored } from './utils'
import { debugLog } from '../../log'
import { config } from '../../config'
import { serializeError, patchModule } from '../utils'
import { tracer } from '../../tracer'

function buildParams(url, options, callback) {
  if (url && options) {
    // in case of both input and options returning all three
    return [url, options, callback]
  }
  if (url && !options) {
    // in case of missing options returning only url and callback
    return [url, callback]
  }
  // url is missing - returning options and callback
  return [options, callback]
}

function responseOnWrapper(wrappedResFunction, chunks) {
  return function internalResponseOnWrapper(resEvent, resCallback) {
    if (resEvent !== 'data' || typeof resCallback !== 'function') {
      return wrappedResFunction.apply(this, [resEvent, resCallback])
    }
    const resPatchedCallback = (chunk) => {
      addChunk(chunk, chunks)
      return resCallback(chunk)
    }
    return wrappedResFunction.apply(
      this,
      [resEvent, resPatchedCallback.bind(this)],
    )
  }
}

function requestOnWrapper(wrappedReqFunction, chunks) {
  return function internalRequestOnWrapper(reqEvent, reqCallback) {
    if (
      reqEvent !== 'response'
      || typeof reqCallback !== 'function'
    ) {
      return wrappedReqFunction.apply(this, [reqEvent, reqCallback])
    }
    const reqPatchedCallback = (res) => {
      if (res && res.RECAP_DEV_PATCHED) {
        return reqCallback(res)
      }
      res.RECAP_DEV_PATCHED = true
      shimmer.wrap(res, 'on', (wrapped) => responseOnWrapper(wrapped, chunks))
      return reqCallback(res)
    }
    return wrappedReqFunction.apply(
      this,
      [reqEvent, reqPatchedCallback.bind(this)],
    )
  }
}


function httpWrapper(wrappedFunction) {
  return function internalHttpWrapper(a, b, c) {
    let url = a
    let options = b
    let callback = c
    const chunks = []
    if (!(['string', 'URL'].includes(typeof url)) && !callback) {
      callback = b
      options = a
      url = undefined
    }

    if ((typeof options === 'function') && (!callback)) {
      callback = options
      options = null
    }

    if (callback && callback.recapDevWrapped) {
      // https->http cases
      return wrappedFunction.apply(this, [a, b, c])
    }

    let clientRequest: any

    try {
      let parsedUrl = url

      if (typeof parsedUrl === 'string') {
        parsedUrl = urlLib.parse(parsedUrl)
      }

      const hostname = (
        (parsedUrl && parsedUrl.hostname)
        || (parsedUrl && parsedUrl.host)
        || (options && options.hostname)
        || (options && options.host)
        || (options && options.uri && options.uri.hostname)
        || 'localhost'
      )

      const path = (
        (parsedUrl && parsedUrl.path)
        || (options && options.path)
        || ('/')
      )

      const pathname = (
        (parsedUrl && parsedUrl.pathname)
        || (options && options.pathname)
        || ('/')
      )

      const headers = (
        (options && options.headers) || {}
      )

      if (isUrlIgnored(hostname, path)) {
        debugLog(`filtered blacklist hostname ${hostname}`)
        return wrappedFunction.apply(this, [a, b, c])
      }

      // TODO: Inject headers here to allow cross-application tracing:
      // const recapDevTraceId = generateRecapDevTraceId()
      // headers['recap-dev-trace-id'] = recapDevTraceId
      //

      const agent = (
        // eslint-disable-next-line no-underscore-dangle
        (options && options.agent) || (options && options._defaultAgent)
        || undefined
      )

      const port = (
        (parsedUrl && parsedUrl.port) || (options && options.port)
        || (options && options.defaultPort) || (agent && agent.defaultPort) || 80
      )

      let protocol = (
        (parsedUrl && parsedUrl.protocol)
        || (port === 443 && 'https:')
        || (options && options.protocol)
        || (agent && agent.protocol)
        || 'http:'
      )

      protocol = protocol.slice(0, -1)

      const body = (
        options
        && options.body
        && (options.body instanceof String || options.body instanceof Buffer)
      ) ? options.body : ''
      const method = (options && options.method) || 'GET'

      const requestUrl = `${protocol}://${hostname}${pathname}`

      const event = tracer.resourceAccessStart(hostname, {
        host: hostname,
        url: requestUrl,
      }, {
        request: {
          url: requestUrl,
          method,
          headers,
          operation: method,
        },
      })

      if (body) {
        debugLog(`Set request body=${body}`)
      }

      if (body) {
        debugLog(`Set request body=${body}`)
      }

      const patchedCallback = (res) => {
        event.response.status = res.statusCode
        event.response.headers = res.headers

        if (res.statusCode >= 400) {
          event.status = 'ERROR'
          event.error = serializeError(new Error(`Response code: ${res.statusCode}`))
        } else {
          event.status = 'OK'
        }

        // Override request headers if they are present here. In some libs they are not
        // available on `options.headers`
        if (res.req && res.req.getHeaders()) {
          event.response.headers = res.req.getHeaders()
        }

        if (headers && 'x-amzn-requestid' in headers) {
          event.serviceName = 'api-gateway'
        }

        if (callback && typeof callback === 'function') {
          callback(res)
        }
      }
      // @ts-ignore
      patchedCallback.recapDevWrapped = true

      clientRequest = wrappedFunction.apply(this, buildParams(url, options, patchedCallback))

      if (
        options
        && options.recapDevSkipResponseData
        && config.disablePayloadCapture
      ) {
        shimmer.wrap(
          clientRequest,
          'on',
          (wrapped) => requestOnWrapper(wrapped, chunks),
        )
      }

      const WriteWrapper = function (wrappedWriteFunc) {
        return function internalWriteWrapper(...args) {
          try {
            if (
              (!body || body === '') && args[0] && (
                (typeof args[0] === 'string') || (args[0] instanceof Buffer)
              )
            ) {
              event.request.body = decodeJson(body, args[0])
            }
          } catch (err) {
            debugLog('Could not parse request body in write wrapper')
          }
          return wrappedWriteFunc.apply(this, args)
        }
      }

      const endWrapper = function (wrappedEndFunc) {
        return function internalEndWrapper(...args) {
          try {
            if (
              (!body || body === '') && args[0] && (
                (typeof args[0] === 'string') || (args[0] instanceof Buffer)
              )
            ) {
              event.request.body = decodeJson(body, args[0])
            }
          } catch (err) {
            debugLog('Could not parse request body in end wrapper')
          }
          return wrappedEndFunc.apply(this, args)
        }
      }

      try {
        shimmer.wrap(clientRequest, 'write', WriteWrapper)
        shimmer.wrap(clientRequest, 'end', endWrapper)
      } catch (err) {
        // In some libs it might not be possible to hook on write
      }


      let isTimeout = false
      clientRequest.on('timeout', () => {
        isTimeout = true
      })

      clientRequest.once('error', (error) => {
        const patchedError = new Error()
        patchedError.message = error.message
        patchedError.stack = error.stack
        patchedError.name = error.name
        if (isTimeout) {
          patchedError.message += '\nTimeout exceeded'
        }
        if (clientRequest.aborted) {
          patchedError.message += '\nRequest aborted'
        }

        event.end = Date.now()
        event.status = 'ERROR'
        event.error = serializeError(patchedError)

        if (clientRequest.listenerCount('error') === 0) {
          throw error
        }
      })

      clientRequest.on('response', (res) => {
        if (
          (!options || (options && !options.recapDevSkipResponseData))
            && !config.disablePayloadCapture
        ) {
          res.on('data', (chunk) => addChunk(chunk, chunks))
        }
        res.on('end', () => {
          const responsePayload = decodeJson(Buffer.concat(chunks), res.headers['content-encoding'])
          event.status = 'OK'
          event.end = Date.now()
          event.response.body = responsePayload
        })
      })
    } catch (error) {
      debugLog(error)
    }

    if (!clientRequest) {
      clientRequest = wrappedFunction.apply(this, [a, b, c])
    }

    return clientRequest
  }
}

function httpGetWrapper(module: any) {
  return function internalHttpGetWrapper(url, options, callback) {
    const req = module.request(url, options, callback)
    req.end()
    return req
  }
}


function fetchH2Wrapper(wrappedFunc) {
  return function internalFetchH2Wrapper(options) {
    return wrappedFunc.apply(this, [{ ...options, recapDevSkipResponseData: true }])
  }
}

export const trackHttp = () => {
  // @ts-ignore
  shimmer.wrap(http, 'get', () => httpGetWrapper(http))
  // @ts-ignore
  shimmer.wrap(http, 'request', httpWrapper)
  // @ts-ignore
  shimmer.wrap(https, 'get', () => httpGetWrapper(https))
  // @ts-ignore
  shimmer.wrap(https, 'request', httpWrapper)

  patchModule(
    'fetch-h2/dist/lib/context-http1',
    'connect',
    fetchH2Wrapper,
    (fetch) => fetch.OriginPool.prototype,
  )
}
