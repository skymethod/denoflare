export function getIsolateId(): string {
    if (!_isolateId) {
        const tokens = crypto.randomUUID().split('-');
        _isolateId = tokens[3] + tokens[4]; // 16 hex char
    }
    return _isolateId;
}

//

let _isolateId: string | undefined;
