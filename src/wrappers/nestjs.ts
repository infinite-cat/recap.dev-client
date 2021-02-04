import 'reflect-metadata'
import { isString, isFunction } from 'lodash-es'

import { wrapClass } from './common'

const isCustomProvider = (provider) => provider && Boolean(provider.provide)

const wrapInjectable = (injectable) => {
  if (!isCustomProvider(injectable)) {
    wrapClass('', injectable.name, injectable, true)
  }

  if (injectable && injectable.useClass) {
    let name = injectable.useClass.name

    if (isString(injectable.provide)) {
      name = injectable.provide
    }

    if (isFunction(injectable.provide)) {
      name = injectable.provide.name
    }

    wrapClass('', name, injectable.useClass, true)
  }
}

/**
 * Wraps a NestJS module with recap.dev tracing
 * This will record all the method calls and add them to a current trace.
 * @param {object} module - NestJS module to wrap
 * @returns {Function} NestJS module
 */
export const wrapNestJsModule = (module: any) => {
  Reflect.getMetadata('controllers', module)?.forEach((injectable) => {
    wrapInjectable(injectable)
  })

  Reflect.getMetadata('providers', module)?.forEach((injectable) =>
    wrapInjectable(injectable)
  )

  return module
}
