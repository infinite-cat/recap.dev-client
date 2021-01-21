export declare const parseQueryArgs: (arg1: any, arg2: any) => {
    params: any;
    callback: any;
};
export declare const extractSqlInformation: (query: string, driver: string) => {
    operation: string;
    dbName: string;
    tableName: string;
} | null;
export declare const wrapSqlQuery: (queryString: any, params: any, callback: any, config: any, driver: any) => any;
