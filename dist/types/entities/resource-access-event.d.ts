export interface ResourceAccessEvent {
    start: number;
    end?: number;
    serviceName: string;
    status: 'OK' | 'ERROR';
    resourceIdentifier?: any;
    request?: any;
    response?: any;
    error?: string;
}
