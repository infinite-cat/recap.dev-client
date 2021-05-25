import { gzipSync } from 'zlib'
import fetch from 'node-fetch'
import { TraceStore } from './services/trace-store'
import { SimpleTraceStore } from './services/simple-trace-store'
import { FunctionCallEvent, ResourceAccessEvent, Trace } from './entities'
import { serializeError } from './module-trackers/utils'
import { debugLog } from './log'
import { config } from './config'

/**
 * @class
 * @classdesc A recap.dev tracer.
 * Stores traces and provides methods to create, sync and add additional information to them.
 */
export class Tracer {
  protected traceStore: TraceStore = new SimpleTraceStore()

  /**
   * Get a current trace
   * @return {Trace | undefined} A current trace or undefined if there's no trace.
   */
  public getCurrentTrace(): Trace | undefined {
    return this.traceStore.getCurrentTrace()
  }

  /**
   * Start a new trace
   * @return {Trace} The new trace
   */
  public startNewTrace(trace: Trace): Trace {
    return this.traceStore.startNewTrace(trace)
  }

  /**
   * Set a trace store.
   * @see {@link TraceStore} for further information.
   */
  public setTraceStore(traceStore: TraceStore) {
    this.traceStore = traceStore
  }

  /**
   * Start a new function call event and add to to the current trace.
   * @param {string} fileName - Name of the file where function is declared.
   * @param {string} functionName - Name of the function.
   * @return {FunctionCallEvent} The new event
   */
  public functionStart(fileName: string, functionName: string): FunctionCallEvent {
    const timestamp = Date.now()

    const event = {
      start: timestamp,
      fileName,
      functionName,
    }

    const trace = this.traceStore.getCurrentTrace()

    if (trace && (!config.disableFunctionCallsCapture || fileName === '')) {
      trace.functionCallEvents.push(event)
    }

    return event
  }

  /**
   * End the function call event, meaning the function has finished execution.
   * @param {FunctionCallEvent} event - event to end.
   */
  public functionEnd(event: FunctionCallEvent) {
    event.end = Date.now()
  }

  /**
   * Start a new resource access event and add to to the current trace.
   * @param {string} serviceName - Name of the service. E.g. MySQL, ElasticSearch, SQS.
   * @param {object} resourceIdentifier - Identifier of an individual resource.
   * E.g. an object with a tableName property for databases or a host for HTTP calls.
   * @param {object} additionalData - Additional data to add to the event.
   * @return {ResourceAccessEvent} The new event
   */
  public resourceAccessStart(
    serviceName: string,
    resourceIdentifier?: any,
    additionalData?: any,
  ): ResourceAccessEvent {
    const timestamp = Date.now()

    const event = {
      start: timestamp,
      serviceName,
      resourceIdentifier,
      request: {},
      response: {},
      ...additionalData,
    }

    const trace = this.traceStore.getCurrentTrace()

    if (trace) {
      trace.resourceAccessEvents.push(event)
    }

    return event
  }

  /**
   * End the resource access event.
   * @param {ResourceAccessEvent} event - event to end.
   */
  public resourceAccessEnd(event: ResourceAccessEvent) {
    event.end = Date.now()
  }

  /**
   * Add log message to the current trace
   * @param {string} log - log message
   */
  public addLogEntry(log: string) {
    const trace = this.traceStore.getCurrentTrace()

    if (trace) {
      trace.logs.push({
        message: log,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Set an error to the current trace.
   * @param {Error} error - error to set
   */
  public setTraceError(error: Error) {
    const trace = this.traceStore.getCurrentTrace()

    if (trace) {
      trace.error = serializeError(error)
      trace.status = 'ERROR'
    }
  }

  /**
   * Associates a trace from the parameter asyncId to the current asyncId
   * @param {number} asyncId - asyncId to use the trace from
   */
  public associateAsyncId(asyncId: number) {
    this.traceStore.associateAsyncId(asyncId)
  }

  /**
   * Set a unit name to the current trace
   * @param {string} unitName - name of the unit
   */
  public setUnitName(unitName: string) {
    const currentTrace = this.getCurrentTrace()
    if (currentTrace) {
      currentTrace.unitName = unitName
    }
  }

  /**
   * Send the current trace to the recap.dev server.
   */
  public async sync() {
    try {
      const timestamp = Date.now()

      const traceToSync = this.traceStore.getCurrentTrace()

      if (!traceToSync || traceToSync.ignore) {
        return
      }

      const dataBuffer = gzipSync(Buffer.from(JSON.stringify(traceToSync), 'utf-8'))

      if (!config.syncEndpoint) {
        debugLog('RECAP_DEV_SYNC_ENDPOINT env variable is empty, skipping sync')
        return
      }

      await fetch(config.syncEndpoint, {
        method: 'POST',
        body: dataBuffer,
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
        },
        timeout: config.syncTimeout,
      })

      debugLog('recap.dev sync took: ', Date.now() - timestamp, ' ms')
    } catch (e) {
      debugLog('Warning: error when syncing trace data')
      debugLog(e)
    }
  }
}

export const tracer = new Tracer()
