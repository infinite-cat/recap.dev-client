import { isFunction } from 'lodash-es'
import 'reflect-metadata'
import { isPromise } from '../utils'
import { tracer } from '../tracer'

/**
 * Wraps a function with recap.dev tracing.
 * This will record all the function calls and add them to a current trace.
 * @param {string} fileName - Name of the file where function is declared.
 * @param {string} functionName - Name of the function.
 * @param {function} func - The function to wrap.
 */
export function wrapFunction(fileName: string, functionName: string, func: any) {
  if (func.recapDevWrapped) {
    return func
  }

  function wrappedFunction(...args: any[]) {
    const event = tracer.functionStart(fileName, functionName)

    // @ts-ignore
    const result = func.call(this, ...args)

    if (isPromise(result)) {
      return result.then((resolvedResult: any) => {
        tracer.functionEnd(event)

        return resolvedResult
      })
    }

    tracer.functionEnd(event)

    return result
  }

  // @ts-ignore
  wrappedFunction.recapDevWrapped = true

  return wrappedFunction
}

/**
 * Wraps a class with recap.dev tracing.
 * This will record all the method calls and add them to a current trace.
 * @param {string} fileName - Name of the file where function is declared.
 * @param {string} className - Name of the class.
 * @param {function} cls - The class to wrap.
 * @param {boolean} moveMetadata - Defines if the metadata will be moved to the wrapped method
 */
export const wrapClass = (fileName: string, className: string, cls: any, moveMetadata = false) => {
  // TODO: figure out how to use variable name instead of a class name
  for (const methodName of Object.getOwnPropertyNames(cls.prototype)) {
    const originalMethod = cls.prototype[methodName]
    if (isFunction(originalMethod) && methodName !== 'constructor') {
      const wrappedMethod = wrapFunction(
        fileName,
        `${className}.${methodName}`,
        cls.prototype[methodName],
      )

      if (moveMetadata) {
        Reflect.getMetadataKeys(originalMethod).forEach((key) => {
          const metadata = Reflect.getMetadata(key, originalMethod)
          Reflect.defineMetadata(key, metadata, wrappedMethod)

          Reflect.deleteMetadata(key, originalMethod)
        })
      }

      cls.prototype[methodName] = wrappedMethod
    }
  }
}
