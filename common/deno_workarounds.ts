const _fetch = fetch;

export function redefineGlobalFetchToWorkaroundBareIpAddresses() {
    // https://github.com/denoland/deno/issues/7660

    // deno-lint-ignore no-explicit-any
    const fetchFromDeno = function(arg1: any, arg2: any) {
        if (typeof arg1 === 'string') {
            let url = arg1 as string;
            if (url.startsWith('https://1.1.1.1/')) {
                url = 'https://one.one.one.one/' + url.substring('https://1.1.1.1/'.length);
            }
            arg1 = url;
        }
        return _fetch(arg1, arg2);
    };

    globalThis.fetch = fetchFromDeno;
}
