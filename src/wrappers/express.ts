import urlLib from 'url'
import { v4 as uuidv4 } from 'uuid'
import { executionAsyncId } from 'async_hooks'
import shimmer from 'shimmer'

import { isUrlIgnored } from '../module-trackers/http/utils'
import { tracer } from '../tracer'
import { AsyncHooksTraceStore } from '../services/async-hooks-trace-store'
import { Trace } from '../entities'
import { debugLog } from '../log'
import { safeParse } from '../utils'
import { config } from '../config'

const newExpressTrace = (req) => {
  const trace = new Trace(uuidv4(), process.env.RECAP_DEV_APP_NAME || req.hostname, 'EXPRESS_HANDLER')

  trace.request = {
    headers: req.headers,
    url: req.url,
    method: req.method,
    params: req.params,
    query: req.query,
  }
  trace.start = Date.now()

  return trace
}

function nextWrapper(next) {
  const asyncId = executionAsyncId()
  const originalNext = next
  return function internalNextWrapper(error, ...rest) {
    if (error) {
      tracer.setTraceError(error)
    }

    tracer.associateAsyncId(asyncId)
    const result = originalNext(...rest)
    tracer.associateAsyncId(asyncId)
    return result
  }
}

function wrapNext(args) {
  const copyArgs = [...args]
  const next = copyArgs[copyArgs.length - 1]
  if (next && next.name === 'next') {
    copyArgs[copyArgs.length - 1] = nextWrapper(args[args.length - 1])
  }

  return copyArgs
}

function wrapMiddleware(middleware) {
  return function internalMiddlewareWrapper(...args) {
    return middleware.apply(this, wrapNext(args))
  }
}

function wrapMethod(original) {
  return function internalMethodWrapper(...args) {
    return original.apply(this, args.map((argument) => {
      if (argument && typeof argument === 'function') {
        return wrapMiddleware(argument)
      }
      return argument
    }))
  }
}

function wrapUse(original) {
  return function internalUseWrapper(...args) {
    return original.apply(this, args.map((argument) => {
      if (argument && typeof argument === 'function') {
        return wrapMiddleware(argument)
      }
      return argument
    }))
  }
}

const appendBodyChunk = (chunk, body) => {
  if (chunk && body.length < config.maxPayloadLength) {
    return body + chunk
  }
  return body
}

const recapExpressMiddleware = (req, res, next) => {
  const originalUrl = urlLib.parse(req.originalUrl)
  const originalWrite = res.write
  const originalEnd = res.end

  let trace: Trace
  let reqBody = ''
  let resBody = ''

  // Handling request body
  req.on('data', (chunk) => {
    reqBody = appendBodyChunk(chunk, reqBody)
  })

  req.on('end', (chunk) => {
    reqBody = appendBodyChunk(chunk, reqBody)
    trace.request.body = safeParse(reqBody) || reqBody
    next()
  })

  // Handling response body
  res.write = function write(...args) {
    resBody = appendBodyChunk(args[0], resBody)
    return originalWrite.apply(res, args)
  }

  res.end = function end(...args) {
    resBody = appendBodyChunk(args[0], resBody)
    originalEnd.apply(res, args)
  }

  if (isUrlIgnored(originalUrl.path, originalUrl.hostname)) {
    debugLog(`Ignoring request: ${req.method} ${req.originalUrl}`)
    next()
    return
  }

  try {
    trace = tracer.startNewTrace(newExpressTrace(req))

    const handlerFunctionEvent = tracer.functionStart('', 'handler')

    res.once('finish', () => {
      try {
        trace.response = {
          headers: res.getHeaders(),
          statusCode: res.statusCode,
          body: safeParse(resBody) || resBody,
        }
        tracer.functionEnd(handlerFunctionEvent)
        trace.end = Date.now()

        if (res.statusCode >= 500) {
          trace.status = 'ERROR'
        }
      } catch (err) {
        debugLog(err)
        tracer.setTraceError(err)
      }
      tracer.sync().then(() => {
        // traceContext.destroyAsync(asyncHooks.executionAsyncId(), true)
      })
    })
  } catch (err) {
    debugLog(err)
    next()
  }
}

function wrapExpress(wrappedFunction) {
  tracer.setTraceStore(new AsyncHooksTraceStore())

  return function internalExpressWrapper(...args) {
    const result = wrappedFunction.apply(this, ...args)
    this.use(recapExpressMiddleware)
    return result
  }
}

const methods = [
  'get',
  'post',
  'put',
  'head',
  'delete',
  'options',
  'trace',
  'copy',
  'lock',
  'mkcol',
  'move',
  'purge',
  'propfind',
  'proppatch',
  'unlock',
  'report',
  'mkactivity',
  'checkout',
  'merge',
  'm-search',
  'notify',
  'subscribe',
  'unsubscribe',
  'patch',
  'search',
  'connect',
]

/**
 * Wraps express with recap.dev tracing.
 * @param {function} express - Express module to wrap.
 * @example
 * import express from 'express'
 * import { traceExpress } from '@recap.dev/client'
 * traceExpress(express)
 * const tracedApp = express()
 */
export const traceExpress = (express) => {
  shimmer.wrap(express.application, 'init', wrapExpress)

  shimmer.wrap(express.Router, 'use', wrapUse)

  for (const method of methods) {
    shimmer.wrap(express.Route.prototype, method, wrapMethod)
  }
}
