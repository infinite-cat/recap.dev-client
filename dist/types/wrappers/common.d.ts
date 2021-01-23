import 'reflect-metadata';
/**
 * Wraps a function with recap.dev tracing.
 * This will record all the function calls and add them to a current trace.
 * @param {string} fileName - Name of the file where function is declared.
 * @param {string} functionName - Name of the function.
 * @param {function} func - The function to wrap.
 */
export declare function wrapFunction(fileName: string, functionName: string, func: any): any;
/**
 * Wraps a class with recap.dev tracing.
 * This will record all the method calls and add them to a current trace.
 * @param {string} fileName - Name of the file where function is declared.
 * @param {string} className - Name of the class.
 * @param {function} cls - The class to wrap.
 * @param {boolean} moveMetadata - Defines if the metadata will be moved to the wrapped method
 */
export declare const wrapClass: (fileName: string, className: string, cls: any, moveMetadata?: boolean) => void;
