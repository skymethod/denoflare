export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeWithRetries<T>(fn: () => Promise<T>, opts: { tag: string, maxRetries: number, isRetryable: (e: Error) => boolean }): Promise<T> {
    const { maxRetries, isRetryable, tag } = opts;

    let retries = 0;
    while (true) {
        try {
            if (retries > 0) {
                const waitMillis = retries * 1000;
                await sleep(waitMillis);
            }
            return await fn();
        } catch (e) {
            if (isRetryable(e)) {
                if (retries >= maxRetries) {
                    throw new Error(`${tag}: Out of retries (max=${maxRetries}): ${e.stack || e}`);
                }
                retries++;
            } else {
                throw e;
            }
        }
    }
}
