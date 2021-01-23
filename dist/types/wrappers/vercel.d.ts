/**
 * Wraps a Vercel handler with recap.dev tracing
 * @param {Function} func - A handler function to wrap
 * @param {Function | string} [unitName] - Either a unitName string or a function to compute one
 * @returns {Function} Wrapped handler function
 */
export declare const wrapVercelHandler: (func: any, unitName?: string | (() => string)) => (request: any, response: any) => void;
