import { TraceStore } from './trace-store';
import { Trace } from '../entities';
export declare class SimpleTraceStore implements TraceStore {
    protected currentTrace?: Trace;
    startNewTrace(trace: Trace): Trace;
    getCurrentTrace(): Trace | undefined;
    associateAsyncId(_: number): void;
}
