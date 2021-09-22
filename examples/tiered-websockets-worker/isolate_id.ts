export function getIsolateId(colo: string): string {
    if (_isolateId) return _isolateId;
    const tokens = crypto.randomUUID().split('-');
    _isolateId = colo + '-' + tokens[3] + tokens[4];
    return _isolateId;
}

//

let _isolateId: string | undefined;
