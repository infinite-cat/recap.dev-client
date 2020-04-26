import fetch from 'node-fetch'
import { gzipSync } from 'zlib'
import { isFunction, cloneDeep } from 'lodash-es'
import { Context } from 'aws-lambda'
import { serializeError } from 'serialize-error'

import { trackModules } from './module-trackers'

trackModules()

let trace: any

const emptyTrace: any = {
  appName: process.env.TRACEMAN_APP_NAME,
  functionCallEvents: [],
  resourceAccessEvents: [],
  status: 'OK',
}

export const functionStart = (fileName: string, functionName: string) => {
  const timestamp = Date.now()

  const event = {
    start: timestamp,
    fileName,
    functionName,
  }

  if (trace) {
    trace.functionCallEvents.push(event)
  }

  return event
}

export const logTracerError = (err: Error) => {
  if (process.env.DEBUG_TRACER) {
    console.log(err)
  }
}

export const resourceAccessStart = (
  serviceName: string,
  resourceIdentifier?: string,
  additionalData?: any,
) => {
  const timestamp = Date.now()

  const event = {
    start: timestamp,
    serviceName,
    resourceIdentifier,
    request: {},
    response: {},
    ...additionalData,
  }

  trace.resourceAccessEvents.push(event)

  return event
}

export const resourceAccessEnd = (event: any) => {
  event.end = Date.now()
}

export const setLambdaRequest = (request: any) => {
  trace.request = request
}

export const setLambdaError = (error: Error) => {
  trace.error = JSON.stringify(serializeError(error))
  trace.status = 'ERROR'
}

export const setLambdaResponse = (response: any) => {
  trace.response = response
}

export const setLambdaContext = (context: any) => {
  trace.id = context && context.awsRequestId
  trace.lambdaName = context && context.functionName
  trace.lambdaContext = context
}

export const functionEnd = (event: any) => {
  const timestamp = Date.now()

  event.end = timestamp
}

const syncTimeout = process.env.TRACEMAN_SYNC_TIMEOUT
  ? Number(process.env.TRACEMAN_SYNC_TIMEOUT)
  : 1000

export const sync = async () => {
  try {
    const timestamp = Date.now()

    const dataBuffer = gzipSync(Buffer.from(JSON.stringify(trace), 'utf-8'))
    console.log('sending bytes: ', Buffer.byteLength(dataBuffer))

    await fetch(process.env.TRACEMAN_SYNC_ENDPOINT!, {
      method: 'POST',
      body: dataBuffer,
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
      },
      timeout: syncTimeout,
    })
    console.log('sending took: ', Date.now() - timestamp, ' ms')
  } catch (e) {
    console.warn('Warning: error when syncing trace data')
    console.error(e)
  }
}

const isPromise = (value: any) => value && isFunction(value.then)

export function wrapFunction(fileName: string, functionName: string, func: any) {
  if (func.autotracerWrapped) {
    return func
  }

  function wrappedFunction(...args: any[]) {
    const event = functionStart(fileName, functionName)

    // @ts-ignore
    const result = func.call(this, ...args)

    if (isPromise(result)) {
      return result.then((resolvedResult: any) => {
        functionEnd(event)

        return resolvedResult
      })
    }

    functionEnd(event)

    return result
  }

  // @ts-ignore
  wrappedFunction.autotracerWrapped = true

  return wrappedFunction
}

export const wrapClass = (fileName: string, className: string, cls: any) => {
  // TODO: somehow figue out how to use variable name instead of class name
  for (const methodName of Object.getOwnPropertyNames(cls.prototype)) {
    if (isFunction(cls.prototype[methodName]) && methodName !== 'constructor') {
      // eslint-disable-next-line no-param-reassign
      cls.prototype[methodName] = wrapFunction(
        fileName,
        `${className}.${methodName}`,
        cls.prototype[methodName],
      )
    }
  }
}

export const wrapLambdaHandler = (func: any) => {
  const wrappedLambdaHandler: any = async (request: any, context: Context) => {
    trace = cloneDeep(emptyTrace)
    const event: any = functionStart('', context.functionName)
    console.log('starting event ', JSON.stringify(event))
    setLambdaRequest({ ...request })

    setLambdaContext(context)

    let result

    try {
      result = func(request, context)
    } catch (e) {
      functionEnd(event)
      setLambdaError(e.toString())
      await sync()
      throw e
    }

    if (isPromise(result)) {
      return result
        .then((resolvedResult: any) => {
          functionEnd(event)

          setLambdaResponse(resolvedResult)

          return sync().then(() => resolvedResult)
        })
        .catch((err) => {
          functionEnd(event)

          setLambdaError(err)

          return sync().then(() => {
            throw err
          })
        })
    }

    setLambdaResponse(result)
    functionEnd(event)

    return sync().then(() => result)
  }

  wrappedLambdaHandler.autotracerWrapped = true

  return wrappedLambdaHandler
}
