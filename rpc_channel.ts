// deno-lint-ignore no-explicit-any
export type Data = any;

export class RpcChannel {
    
    private readonly requests = new Map<number, Request>();
    private readonly postMessage: (message: Data, transfer: Transferable[]) => void;
    private readonly requestDataHandlers = new Map<string, RequestDataHandler>();
    private readonly tag: string;

    private nextRequestNum = 1;

    constructor(tag: string, postMessage: (message: Data, transfer: Transferable[]) => void) {
        this.tag = tag;
        this.postMessage = postMessage;
    }

    async receiveMessage(data: Data): Promise<boolean> /*handled*/ {
        if (isRpcResponse(data)) {
            _consoleLog(`${this.tag}: receiveMessage response ${data.rpcMethod}`);
            const request = this.requests.get(data.num);
            if (request) {
                this.requests.delete(data.num);
                request.onRpcResponse(data);
            }
            return true;
        }

        if (isRpcRequest(data)) {
            _consoleLog(`${this.tag}: receiveMessage request ${data.rpcMethod}`);
            const { rpcMethod, num } = data;
            const handler = this.requestDataHandlers.get(rpcMethod);
            if (handler) {
                let responseData: Data | undefined;
                let error: Error | undefined;
                try {
                    responseData = await handler(data.data);
                } catch (e) {
                    error = e;
                }
                if (error) {
                    this.postMessage({ responseKind: 'error', num, rpcMethod, error: { message: error.message, name: error.name, stack: error.stack} } as RpcErrorResponse, []);
                } else {
                    this.postMessage({ responseKind: 'ok', num, rpcMethod, data: responseData } as RpcOkResponse, []);
                }
            }
            return true;
        }

        return false;
    }

    sendRequest<T>(rpcMethod: string, data: Data, unpackResponseDataFn: (data: Data) => T, transfer: Transferable[] = []): Promise<T> {
        const num = this.nextRequestNum++;
        const request: Request = { num, onRpcResponse: () => {}};
        this.requests.set(num, request);
        const rt = new Promise<T>((resolve, reject) => {
            request.onRpcResponse = (rpcResponse) => {
                if (rpcResponse.rpcMethod !== rpcMethod) {
                    reject(new Error(`Bad rpcResponse.rpcMethod: ${rpcResponse.rpcMethod}, expected ${rpcMethod}`));
                } else if (rpcResponse.responseKind === 'error') {
                    // console.log('ERROR', rpcResponse);
                    reject(rpcResponse.error);
                } else if (rpcResponse.responseKind === 'ok') {
                    resolve(unpackResponseDataFn(rpcResponse.data));
                } else {
                    reject(new Error(`Unknown rpcResponse.responseKind: ${rpcResponse}`));
                }
            }
        });
        const rpcRequest: RpcRequest = { requestKind: 'rpc', rpcMethod, num, data };
        _consoleLog(`${this.tag}: sendRequest ${rpcRequest.rpcMethod}`);
        this.postMessage(rpcRequest, transfer);
        return rt;
    }

    addRequestHandler(rpcMethod: string, requestDataHandler: RequestDataHandler) {
        this.requestDataHandlers.set(rpcMethod, requestDataHandler);
    }

}

//

const _consoleLog = console.log;

function isRpcResponse(data: Data): data is RpcResponse {
    return typeof data.num === 'number' && typeof data.rpcMethod === 'string' && typeof data.responseKind === 'string';
}

function isRpcRequest(data: Data): data is RpcRequest {
    return typeof data.num === 'number' && typeof data.rpcMethod === 'string' && typeof data.requestKind === 'string';
}

//

type RequestDataHandler = (requestData: Data) => Promise<Data>;

interface Request {
    num: number;
    onRpcResponse: (rpcResponse: RpcResponse) => void;
}

type RpcResponse = RpcErrorResponse | RpcOkResponse;

interface RpcErrorResponse {
    readonly responseKind: 'error'
    readonly num: number;
    readonly rpcMethod: string;
    readonly error: Error;
}

interface RpcOkResponse {
    readonly responseKind: 'ok'
    readonly num: number;
    readonly rpcMethod: string;
    readonly data: Data;
}

interface RpcRequest {
    readonly requestKind: 'rpc'
    readonly num: number;
    readonly rpcMethod: string;
    readonly data: Data;
}
