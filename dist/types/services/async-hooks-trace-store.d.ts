/// <reference types="node" />
import { AsyncHook } from 'async_hooks';
import { TraceStore } from './trace-store';
import { Trace } from '../entities';
export declare class AsyncHooksTraceStore implements TraceStore {
    protected traceMap: Map<number, Trace>;
    protected hook: AsyncHook;
    constructor();
    startNewTrace(trace: Trace): Trace;
    getCurrentTrace(): Trace | undefined;
    associateAsyncId(parentAsyncId: number): void;
}
