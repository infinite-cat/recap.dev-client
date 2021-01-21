/// <reference types="node" />
import { ServerResponse } from 'http';
/**
 * Wraps a Vercel handler with recap.dev tracing
 * @param {Function} func - A handler function to wrap
 * @returns {Function} Wrapped handler function
 */
export declare const wrapVercelHandler: (func: any) => (request: any, response: ServerResponse) => void;
