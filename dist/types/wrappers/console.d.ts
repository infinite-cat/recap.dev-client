/**
 * Captures following methods of the global console object with recap.dev tracing:
 * log, error, info, trace, warn, dir
 * This will add all messages to a current trace
 * @example
 * import { captureConsoleLogs } from '@recap.dev/client'
 * captureConsoleLogs()
 */
export declare const captureConsoleLogs: () => void;
