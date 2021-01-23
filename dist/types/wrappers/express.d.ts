/**
 * Wraps express with recap.dev tracing.
 * @param {function} express - Express module to wrap.
 * @example
 * import express from 'express'
 * import { traceExpress } from '@recap.dev/client'
 * traceExpress(express)
 * const tracedApp = express()
 */
export declare const traceExpress: (express: any) => void;
