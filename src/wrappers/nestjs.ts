import 'reflect-metadata'

import { wrapClass } from './common'

/**
 * Wraps a NestJS module with recap.dev tracing
 * This will record all the method calls and add them to a current trace.
 * @param {object} module - NestJS module to wrap
 * @returns {Function} NestJS module
 */
export const wrapNestJsModule = (module: any) => {
  Reflect.getMetadata('controllers', module).forEach((injectable) => {
    wrapClass('', injectable.name, injectable, true)
  })

  Reflect.getMetadata('providers', module).forEach((injectable) => wrapClass('', injectable.name, injectable, true))

  return module
}
