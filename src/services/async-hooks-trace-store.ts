import { AsyncHook, createHook, executionAsyncId } from 'async_hooks'
import { TraceStore } from './trace-store'
import { Trace } from '../entities'

export class AsyncHooksTraceStore implements TraceStore {
  protected traceMap: Map<number, Trace> = new Map<number, Trace>()

  protected hook: AsyncHook

  public constructor() {
    this.hook = createHook({
      init: (asyncId: number, type: string, parentAsyncId: number) => {
        const parentTrace = this.traceMap.get(parentAsyncId)

        if (parentTrace) {
          this.traceMap.set(asyncId, parentTrace)
        }
      },
      destroy: (asyncId: number) => {
        this.traceMap.delete(asyncId)
      },
      promiseResolve: (asyncId: number) => {
        const currentTrace = this.traceMap.get(executionAsyncId())

        if (currentTrace) {
          this.traceMap.set(asyncId, currentTrace)
        }
      },
    })

    this.hook.enable()
  }

  startNewTrace(trace: Trace) {
    this.traceMap.set(executionAsyncId(), trace)
    return trace
  }

  getCurrentTrace(): Trace | undefined {
    return this.traceMap.get(executionAsyncId())
  }

  associateAsyncId(parentAsyncId: number) {
    const parentTrace = this.traceMap.get(parentAsyncId)

    if (!parentTrace) {
      return
    }

    this.traceMap.set(executionAsyncId(), parentTrace)
  }
}
