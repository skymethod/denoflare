// https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html#http-api-develop-integrations-lambda.proxy-format

export interface LambdaHttpRequest {
    readonly version: string; // 2.0
    readonly routeKey: string; // $default
    readonly rawPath: string; // /path
    readonly rawQueryString: string // foo=bar or ""
    readonly cookies?: string[];
    readonly headers: Record<string, string>,
    readonly requestContext: {
        readonly accountId: string; // anonymous
        readonly apiId: string; // <32-loweralphanum>
        readonly domainName: string; // <32-loweralphanum>.lambda-url.<region>.on.aws
        readonly domainPrefix: string; // <32-loweralphanum>
        readonly http: {
            readonly method: string; // GET
            readonly path: string; // /path
            readonly protocol: string; // HTTP/1.1
            readonly sourceIp: string;
            readonly userAgent: string;
        },
        readonly requestId: string; // v4 guid
        readonly routeKey: string; // $default
        readonly stage: string; // $default
        readonly time: string; // 08/Jul/2023:01:33:58 +0000
        readonly timeEpoch: number; // 1688780038228
    },
    readonly body?: string;
    readonly isBase64Encoded: boolean;
}
