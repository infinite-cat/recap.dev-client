import { TraceStore } from './services/trace-store';
import { FunctionCallEvent, ResourceAccessEvent, Trace } from './entities';
/**
 * @class
 * @classdesc A recap.dev tracer. Stores traces and provides methods to create, sync and add additional information to them.
 */
export declare class Tracer {
    protected traceStore: TraceStore;
    /**
     * Get a current trace
     * @return {Trace | undefined} A current trace or undefined if there's no trace.
     */
    getCurrentTrace(): Trace | undefined;
    /**
     * Start a new trace
     * @return {Trace} The new trace
     */
    startNewTrace(trace: Trace): Trace;
    /**
     * Set a trace store.
     * @see {@link TraceStore} for further information.
     */
    setTraceStore(traceStore: TraceStore): void;
    /**
     * Start a new function call event and add to to the current trace.
     * @param {string} fileName - Name of the file where function is declared.
     * @param {string} functionName - Name of the function.
     * @return {FunctionCallEvent} The new event
     */
    functionStart(fileName: string, functionName: string): FunctionCallEvent;
    /**
     * End the function call event, meaning the function has finished execution.
     * @param {FunctionCallEvent} event - event to end.
     */
    functionEnd(event: FunctionCallEvent): void;
    /**
     * Start a new resource access event and add to to the current trace.
     * @param {string} serviceName - Name of the service. E.g. MySQL, ElasticSearch, SQS.
     * @param {object} resourceIdentifier - Identifier of an individual resource. E.g. an object with a tableName property for databases or a host for HTTP calls.
     * @param {object} additionalData - Additional data to add to the event.
     * @return {ResourceAccessEvent} The new event
     */
    resourceAccessStart(serviceName: string, resourceIdentifier?: any, additionalData?: any): ResourceAccessEvent;
    /**
     * End the resource access event.
     * @param {ResourceAccessEvent} event - event to end.
     */
    resourceAccessEnd(event: ResourceAccessEvent): void;
    /**
     * Add log message to the current trace
     * @param {string} log - log message
     */
    addLogEntry(log: string): void;
    /**
     * Set an error to the current trace.
     * @param {Error} error - error to set
     */
    setTraceError(error: Error): void;
    /**
     * Associates a trace from the parameter asyncId to the current asyncId
     * @param {number} asyncId - asyncId to use the trace from
     */
    associateAsyncId(asyncId: number): void;
    /**
     * Set a unit name to the current trace
     * @param {string} unitName - name of the unit
     */
    setUnitName(unitName: string): void;
    /**
     * Send the current trace to the recap.dev server.
     */
    sync(): Promise<void>;
}
export declare const tracer: Tracer;
