export interface FunctionCallEvent {
    fileName: string;
    functionName: string;
    start: number;
    end?: number;
}
