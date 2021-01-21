import { ClientRequest, ServerResponse } from 'http'
import { v4 as uuidv4 } from 'uuid'

import { captureConsoleLogs } from './console'
import { Trace } from '../entities'
import { tracer } from '../tracer'
import { debugLog } from '../log'

const newVercelTrace = (request: ClientRequest) => {
  const trace = new Trace(uuidv4(), request.path, 'VERCEL')

  trace.request = { ...request }

  return trace
}

/**
 * Wraps a Vercel handler with recap.dev tracing
 * @param {Function} func - A handler function to wrap
 * @returns {Function} Wrapped handler function
 */
export const wrapVercelHandler = (func) => {
  const wrappedVercelHandler = (request, response: ServerResponse) => {
    const trace = tracer.startNewTrace(newVercelTrace(request))

    const handlerFunctionEvent = tracer.functionStart('', 'handler')

    response.once('finish', () => {
      try {
        trace.response = {
          headers: response.getHeaders(),
          statusCode: response.statusCode,
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
      tracer.sync()
    })

    func(request, response)
  }

  captureConsoleLogs()

  return wrappedVercelHandler
}
