import shimmer from 'shimmer'
import jsonStringify from 'json-stringify-safe'
import { isError, isObject } from 'lodash-es'
import { tracer } from '../tracer'
import { serializeError } from '../module-trackers/utils'

/**
 * Captures following methods of the global console object with recap.dev tracing:
 * log, error, info, trace, warn, dir
 * This will add all messages to a current trace
 * @example
 * import { captureConsoleLogs } from '@recap.dev/client'
 * captureConsoleLogs()
 */
export const captureConsoleLogs = () => {
  const consoleLogWrapper = (original) => (...args) => {
    tracer.addLogEntry(
      args
        .map((arg) => {
          if (isError(arg)) {
            return serializeError(arg)
          }

          if (isObject(arg)) {
            return jsonStringify(arg)
          }

          return arg
        })
        .join(),
    )

    return original(...args)
  }

  shimmer.massWrap([console], ['log', 'error', 'info', 'trace', 'warn', 'dir'], consoleLogWrapper)
}
