import { gzipSync } from 'zlib'
import fetch from 'node-fetch'
import { cloneDeep, isFunction } from 'lodash-es'
import { Context } from 'aws-lambda'

import { debugLog } from './log'
import { serializeError } from './module-trackers/utils'

let trace: any

const emptyTrace: any = {
  appName: process.env.RECAP_DEV_APP_NAME,
  functionCallEvents: [],
  resourceAccessEvents: [],
  status: 'OK',
  extraData: {},
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
  trace.unitType = 'AWS_LAMBDA'
  trace.context = context
  trace.extraData.awsRegion = process.env.AWS_REGION
  trace.extraData.awsAccountId = context
    && context.invokedFunctionArn
    && context.invokedFunctionArn.split(':')[4]
  trace.extraData.awsLogStreamName = context && context.logStreamName
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
    debugLog('recap.dev syncing took: ', Date.now() - timestamp, ' ms')
  } catch (e) {
    debugLog('Warning: error when syncing trace data')
    debugLog(e)
  }
}

const isPromise = (value: any) => (
  value
  && isFunction(value.then)
  && Object.prototype.toString.call(value) === '[object Promise]'
)

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

const timeoutWindow = process.env.RECAP_DEV_TIMEOUT_WINDOW ? Number(process.env.RECAP_DEV_TIMEOUT_WINDOW) : 200

export const wrapLambdaHandler = (func: any) => {
  const wrappedLambdaHandler: any = async (request: any, context: Context) => {
    trace = cloneDeep(emptyTrace)
    const event: any = functionStart('', context.functionName)

    const timeoutHandler = setTimeout(() => {
      functionEnd(event)

      sync()
    }, context.getRemainingTimeInMillis() - timeoutWindow)

    setLambdaRequest({ ...request })

    setLambdaContext(context)

    let result

    try {
      result = func(request, context)
    } catch (e) {
      functionEnd(event)
      setLambdaError(e.toString())
      clearTimeout(timeoutHandler)
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

          clearTimeout(timeoutHandler)
          return sync().then(() => {
            throw err
          })
        })
    }

    setLambdaResponse(result)
    functionEnd(event)

    clearTimeout(timeoutHandler)
    return sync().then(() => result)
  }

  wrappedLambdaHandler.recapDevWrapped = true

  return wrappedLambdaHandler
}
