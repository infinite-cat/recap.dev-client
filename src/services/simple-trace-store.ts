import { TraceStore } from './trace-store'
import { Trace } from '../entities'

export class SimpleTraceStore implements TraceStore {
  protected currentTrace?: Trace

  startNewTrace(trace: Trace) {
    this.currentTrace = trace
    return this.currentTrace
  }

  getCurrentTrace(): Trace | undefined {
    return this.currentTrace
  }

  associateAsyncId(_: number) {
    throw new Error('Current trace store doesn\t support async hooks. Try setting a supported trace store, for example tracer.setTraceStore(new AsyncHooksTraceStore())')
  }
}
