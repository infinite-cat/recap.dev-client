import { v4 as uuidv4 } from 'uuid'

import { captureConsoleLogs } from './console'
import { Trace } from '../entities'
import { tracer } from '../tracer'
import { debugLog } from '../log'
import { safeParse, appendBodyChunk } from '../utils'

const newVercelTrace = (request: any) => {
  const trace = new Trace(uuidv4(), request.path, 'VERCEL')

  trace.request = {
    headers: request.rawHeaders,
    url: request.url,
    method: request.method,
    params: request.params,
    query: request.query,
    body: request.body,
  }

  return trace
}


/**
 * Wraps a Vercel handler with recap.dev tracing
 * @param {Function} func - A handler function to wrap
 * @returns {Function} Wrapped handler function
 */
export const wrapVercelHandler = (func) => {
  const wrappedVercelHandler = (request, response) => {
    const trace = tracer.startNewTrace(newVercelTrace(request))

    const handlerFunctionEvent = tracer.functionStart('', 'handler')

    const originalWrite = response.write
    const originalEnd = response.end
    let resBody = ''

    // Handling response body
    response.write = function write(...args: any[]) {
      resBody = appendBodyChunk(args[0], resBody)
      return originalWrite.apply(response, args)
    }

    response.end = function end(...args) {
      resBody = appendBodyChunk(args[0], resBody)
      originalEnd.apply(response, args)
    }

    response.once('finish', () => {
      try {
        debugLog('response body: ', resBody)
        trace.response = {
          headers: response.getHeaders(),
          statusCode: response.statusCode,
          body: safeParse(resBody) || resBody,
        }
        tracer.functionEnd(handlerFunctionEvent)
        trace.end = Date.now()

        if (response.statusCode >= 500) {
          trace.status = 'ERROR'
        }
      } catch (err) {
        debugLog(err)
        tracer.setTraceError(err)
      }
      tracer.sync().then(() => {
      })
    })

    func(request, response)
  }

  captureConsoleLogs()

  return wrappedVercelHandler
}
