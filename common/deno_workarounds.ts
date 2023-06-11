const _fetch = fetch;

export function redefineGlobalFetchToWorkaroundBareIpAddresses() {
    // https://github.com/denoland/deno/issues/7660
    // fixed in v1.33.4 !

    // deno-lint-ignore no-explicit-any
    const fetchFromDeno = function(arg1: any, arg2: any) {
        if (typeof arg1 === 'string') {
            const url = tryModifyUrl(arg1);
            if (url !== undefined) {
                arg1 = url;
            }
        } else if (arg1 instanceof Request) {
            const url = tryModifyUrl(arg1.url);
            if (url !== undefined) {
                arg1 = new Request(url, arg1);
            }
        }
        return _fetch(arg1, arg2);
    };
    globalThis.fetch = fetchFromDeno;
}

//

function tryModifyUrl(url: string): string | undefined {
    if (url.startsWith('https://1.1.1.1/')) {
        return 'https://one.one.one.one/' + url.substring('https://1.1.1.1/'.length);
    }
}
