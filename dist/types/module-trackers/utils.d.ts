export declare const tryRequire: any;
export declare const getModules: (id: string) => any[];
export declare const patchModule: (id: string, methodName: string, wrapper: any, memberExtractor?: (mod: any) => any) => void;
export declare const serializeError: (err?: Error | undefined) => string | undefined;
