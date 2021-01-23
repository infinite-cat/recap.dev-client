import { FunctionCallEvent } from './function-call-event';
import { ResourceAccessEvent } from './resource-access-event';
import { LogEntry } from './log-entry';
export declare class Trace {
    id?: string;
    unitName: string;
    unitType: string;
    request: any;
    response: any;
    start?: number;
    end?: number;
    error?: string;
    logs: LogEntry[];
    appName: string | undefined;
    status: 'OK' | 'ERROR';
    functionCallEvents: FunctionCallEvent[];
    resourceAccessEvents: ResourceAccessEvent[];
    extraData: any;
    constructor(id: string, unitName: string, unitType: string);
}
