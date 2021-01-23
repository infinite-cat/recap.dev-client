import { Trace } from '../entities';
export interface TraceStore {
    startNewTrace(trace: Trace): Trace;
    getCurrentTrace(): Trace | undefined;
    associateAsyncId(parentAsyncId: number): any;
}
