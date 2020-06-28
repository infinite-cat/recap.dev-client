import shimmer from 'shimmer'
import urlLib from 'url'
import { serializeError, tryRequire } from '../utils'
import { addChunk, decodeJson, isUrlIgnored } from './utils'
import { disablePayloadCapture } from '../../config'
import { debugLog } from '../../log'
import { resourceAccessStart } from '../../trace'

const http2 = tryRequire('http2')

const extractHeaders = (headers) => Object.entries(headers)
  .filter((header) => !header[0].startsWith(':'))
  .reduce((obj, header) => {
    const [key, value] = header
    obj[key] = value
    return obj
  }, {})

function httpWrapper(wrappedFunction, authority) {
  return function internalHttpWrapper(headers, options) {
    let clientRequest: any = null
    let event
    try {
      const { hostname } = urlLib.parse(authority)

      if (isUrlIgnored(hostname, headers[':path'])) {
        debugLog(`filtered blacklist hostname ${hostname}`)
        return wrappedFunction.apply(this, [headers, options])
      }

      const reqHeaders = extractHeaders(headers)

      // TODO: Inject headers here to allow cross-application tracing:
      // const recapDevTraceId = generateRecapDevTraceId()
      // headers['recap-dev-trace-id'] = recapDevTraceId
      //

      event = resourceAccessStart(hostname!, {
        host: hostname,
        url: authority,
      }, {
        request: {
          url: authority,
          method: headers[':method'],
          headers: reqHeaders,
          operation: headers[':method'],
        },
      })
    } catch (error) {
      debugLog(error)
      return wrappedFunction.apply(this, [headers, options])
    }

    try {
      clientRequest = wrappedFunction.apply(this, [headers, options])
    } catch (err) {
      event.end = Date.now()
      event.status = 'ERROR'
      event.error = serializeError(err)
      throw err
    }

    try {
      const chunks: Buffer[] = []
      let responseHeaders
      if (!disablePayloadCapture) {
        clientRequest!.on('data', (chunk) => {
          addChunk(chunk, chunks)
        })
      }

      clientRequest!.once('error', (error) => {
        event.end = Date.now()
        event.status = 'ERROR'
        event.error = serializeError(error)

        if (clientRequest.listenerCount('error') === 0) {
          throw error // no error listener, we should explode
        }
      })

      clientRequest.once('close', () => {
        event.end = Date.now()

        if (!disablePayloadCapture) {
          const response = decodeJson(Buffer.concat(chunks), responseHeaders['content-encoding'])
          event.response.body = response
        }
      })

      clientRequest.once('response', (res) => {
        event.end = Date.now()
        event.status = 'OK'

        const statusCode = res[':status']

        if (statusCode >= 400) {
          event.status = 'ERROR'
          event.error = serializeError(new Error(`Response code: ${res.statusCode}`))
        }

        if (headers && 'x-amzn-requestid' in headers) {
          event.serviceName = 'api-gateway'
        }

        responseHeaders = extractHeaders(res)

        event.response.status = statusCode
        event.response.headers = responseHeaders
      })
    } catch (error) {
      debugLog(error)
    }

    return clientRequest
  }
}

function wrapHttp2Connect(connectFunction) {
  return function innerWrapHttp2Connect(authority, options, listener) {
    const clientSession = connectFunction.apply(this, [authority, options, listener])
    try {
      shimmer.wrap(clientSession, 'request', (wrappedFunction) => httpWrapper(wrappedFunction, authority))
    } catch (err) {
      debugLog(`Could not instrument http2 session request ${err}`)
    }
    return clientSession
  }
}

export const trackHttp2 = () => {
  if (http2) {
    debugLog('Patching http2 module')
    shimmer.wrap(http2, 'connect', wrapHttp2Connect)
  }
}
