import fetch from 'node-fetch'
import { gzipSync } from 'zlib'
import { isFunction, cloneDeep } from 'lodash-es'
import { Context } from 'aws-lambda'

import { trackModules } from './module-trackers'
import { serializeError } from './module-trackers/utils'

trackModules()

let trace: any

const emptyTrace: any = {
  appName: process.env.RECAP_DEV_APP_NAME,
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

export const debugLog = (...args: any) => {
  if (process.env.RECAP_DEV_DEBUG_LOG) {
    console.log(...args)
  }
}

export const resourceAccessStart = (
  serviceName: string,
  resourceIdentifier?: any,
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
  trace.error = serializeError(error)
  trace.status = 'ERROR'
}

export const setLambdaResponse = (response: any) => {
  trace.response = response
}

export const setLambdaContext = (context: any) => {
  trace.id = context && context.awsRequestId
  trace.unitName = context && context.functionName
  trace.context = context
}

export const functionEnd = (event: any) => {
  const timestamp = Date.now()

  event.end = timestamp
}

const syncTimeout = process.env.RECAP_DEV_SYNC_TIMEOUT
  ? Number(process.env.RECAP_DEV_SYNC_TIMEOUT)
  : 1000

export const sync = async () => {
  try {
    const timestamp = Date.now()

    const dataBuffer = gzipSync(Buffer.from(JSON.stringify(trace), 'utf-8'))

    if (!process.env.RECAP_DEV_SYNC_ENDPOINT) {
      debugLog('RECAP_DEV_SYNC_ENDPOINT env variable is empty, skipping sync')
      return
    }

    await fetch(process.env.RECAP_DEV_SYNC_ENDPOINT, {
      method: 'POST',
      body: dataBuffer,
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
      },
      timeout: syncTimeout,
    })
    debugLog('sending took: ', Date.now() - timestamp, ' ms')
  } catch (e) {
    debugLog('Warning: error when syncing trace data')
    debugLog(e)
  }
}

const isPromise = (value: any) => value && isFunction(value.then)

export function wrapFunction(fileName: string, functionName: string, func: any) {
  if (func.recapDevWrapped) {
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
  wrappedFunction.recapDevWrapped = true

  return wrappedFunction
}

export const wrapClass = (fileName: string, className: string, cls: any) => {
  // TODO: somehow figure out how to use variable name instead of class name
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

  wrappedLambdaHandler.recapDevWrapped = true

  return wrappedLambdaHandler
}
