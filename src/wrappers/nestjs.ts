import 'reflect-metadata'
import { isString, isFunction } from 'lodash-es'
import Hook from 'require-in-the-middle'

import { wrapClass } from './common'
import { Trace } from '../entities'
import { tracer } from '../tracer'
import { captureConsoleLogs } from './console'
import { AsyncHooksTraceStore } from '../services/async-hooks-trace-store'
import { traceExpress } from './express'

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

  Reflect.getMetadata('providers', module)?.forEach((injectable) => wrapInjectable(injectable))

  return module
}

const defaultUnitNameStrategy = (trace: Trace) =>
  trace?.functionCallEvents[1]?.functionName &&
  `${process.env.environment}-${trace?.functionCallEvents[1]?.functionName}`

const defaultOptions = {
  captureLogs: true,
  assignUnitName: defaultUnitNameStrategy,
  ignoreUnnamedUnits: true,
  disableAutomaticUnitNames: false,
}

let onNestJsAppCreated = (app: any) => app

Hook(['@nestjs/core'], (nestCore) => {
  const originalCreate = nestCore?.NestFactory?.create

  if (originalCreate) {
    // eslint-disable-next-line func-names
    nestCore.NestFactory.create = async function (...args: any[]) {
      const app = await originalCreate.call(this, ...args)

      return onNestJsAppCreated(app)
    }
  }

  return nestCore
})

export interface WrapNestJsApplicationOptions {
  /**
   * Enables or disables capture of logs from global console object. Defaults to true
   */
  captureLogs?: boolean
  /**
   * Disables default `environment-injectable.methodName` unit names. Defaults to false
   */
  disableAutomaticUnitNames?: boolean
  /**
   * Ignore traces without a unit name assigned. Defaults to true
   */
  ignoreUnnamedUnits?: boolean
  /**
   * Defines how unit names are assigned to the trace.
   * Default strategy creates unit names with the following pattern: `environment-injectable.methodName`
   * @param {Trace} trace - a trace to create a unit name for.
   * @returns {string} - a unit name to assign to the trace.
   */
  assignUnitName?: (trace: Trace) => string
}

/**
 * Enables and configures NestJS tracing
 * @param {WrapNestJsApplicationOptions} options - NestJS tracing configuration
 */
export const initNestJsTracing = (options?: WrapNestJsApplicationOptions) => {
  const config = {
    ...defaultOptions,
    ...options,
  }

  tracer.setTraceStore(new AsyncHooksTraceStore())

  if (config.captureLogs) {
    captureConsoleLogs()
  }

  Hook(['express'], (express) => {
    traceExpress(express)

    return express
  })

  onNestJsAppCreated = (app) => {
    if (!config.disableAutomaticUnitNames) {
      app.use?.((req, res, next) => {
        res.prependListener('finish', () => {
          const currentTrace = tracer.getCurrentTrace()
          if (!currentTrace) {
            return
          }

          const unitName = config.assignUnitName(currentTrace)

          if (!unitName && config.ignoreUnnamedUnits) {
            currentTrace.ignore = true
            return
          }

          currentTrace.unitName = unitName
        })

        next()
      })
    }

    return app
  }
}
