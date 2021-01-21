import 'reflect-metadata';
/**
 * Wraps a NestJS module with recap.dev tracing
 * This will record all the method calls and add them to a current trace.
 * @param {object} module - NestJS module to wrap
 * @returns {Function} NestJS module
 */
export declare const wrapNestJsModule: (module: any) => any;
