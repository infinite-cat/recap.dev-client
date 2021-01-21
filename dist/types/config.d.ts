declare class Config {
    get disablePayloadCapture(): boolean;
    get syncTimeout(): number;
    get syncEndpoint(): string | undefined;
    get serverlessTimeoutWindow(): number;
    get pgDriverModulePath(): string;
    get isDebugLogEnabled(): boolean;
}
export declare const config: Config;
export {};
