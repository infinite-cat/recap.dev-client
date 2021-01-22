import { Context } from 'aws-lambda'

import { config } from '../config'
import { tracer } from '../tracer'
import { Trace } from '../entities'
import { isPromise } from '../utils'
import { debugLog } from '../log'
import { captureConsoleLogs } from './console'

const newLambdaTrace = (request: any, context: Context) => {
  const trace = new Trace(context.awsRequestId, context.functionName, 'AWS_LAMBDA')

  trace.request = { ...request }

  trace.extraData.awsRegion = process.env.AWS_REGION
  trace.extraData.awsAccountId = context
    && context.invokedFunctionArn
    && context.invokedFunctionArn.split(':')[4]
  trace.extraData.awsLogStreamName = context && context.logStreamName

  return trace
}

/**
 * Wraps lambda handler with recap.dev tracing
 * @param {function} func - The request handler function.
 */
export const wrapLambdaHandler = (func: any) => {
  captureConsoleLogs()
  const wrappedLambdaHandler: any = async (request: any, context: Context) => {
    if (!context) {
      debugLog('No lambda context passed, skipping recap.dev tracing')
      return func(request, context)
    }

    const trace = tracer.startNewTrace(newLambdaTrace(request, context))

    const event: any = tracer.functionStart('', context.functionName)

    let timeoutHandler

    if (context.getRemainingTimeInMillis) {
      timeoutHandler = setTimeout(() => {
        tracer.functionEnd(event)

        tracer.sync()
      }, context.getRemainingTimeInMillis() - config.serverlessTimeoutWindow)
    }

    let result

    try {
      result = func(request, context)
    } catch (e) {
      tracer.functionEnd(event)
      tracer.setTraceError(e.toString())
      clearTimeout(timeoutHandler)
      await tracer.sync()
      throw e
    }

    if (isPromise(result)) {
      return result
        .then((resolvedResult: any) => {
          tracer.functionEnd(event)

          trace.response = { ...resolvedResult }

          clearTimeout(timeoutHandler)

          return tracer.sync().then(() => resolvedResult)
        })
        .catch((err) => {
          tracer.functionEnd(event)

          tracer.setTraceError(err)

          clearTimeout(timeoutHandler)
          return tracer.sync().then(() => {
            throw err
          })
        })
    }

    trace.response = { ...result }
    tracer.functionEnd(event)

    clearTimeout(timeoutHandler)
    return tracer.sync().then(() => result)
  }

  wrappedLambdaHandler.recapDevWrapped = true

  return wrappedLambdaHandler
}
