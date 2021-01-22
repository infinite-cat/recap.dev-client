import { v4 as uuidv4 } from 'uuid'
import callsites from 'callsites'
import { isFunction, last } from 'lodash-es'

import { captureConsoleLogs } from './console'
import { Trace } from '../entities'
import { tracer } from '../tracer'
import { debugLog } from '../log'
import { safeParse, appendBodyChunk } from '../utils'

const newVercelTrace = (request: any, unitName: string) => {
  const trace = new Trace(uuidv4(), unitName, 'VERCEL')

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

const defaultUnitNameStrategy = () => (
  process.env.VERCEL_ENV + '/api/' + last(callsites()[2]?.getFileName()?.split('/api/'))
)

/**
 * Wraps a Vercel handler with recap.dev tracing
 * @param {Function} func - A handler function to wrap
 * @param {Function | string} [unitName] - Either a unitName string or a function to compute one
 * @returns {Function} Wrapped handler function
 */
export const wrapVercelHandler = (func, unitName: (() => string) | string = defaultUnitNameStrategy) => {
  const wrappedVercelHandler = (request, response) => {
    try {
      const name = isFunction(unitName) ? unitName() : unitName

      const trace = tracer.startNewTrace(newVercelTrace(request, name))

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

        try {
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
          originalEnd.apply(response, args)
        })
      }
    } catch (err) {
      debugLog(err)
    }

    func(request, response)
  }

  captureConsoleLogs()

  return wrappedVercelHandler
}
