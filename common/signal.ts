export class Signal<T> {
    readonly promise: Promise<T>;

    private resolveFn?: (result: T) => void;
    private rejectFn?: (reason: unknown) => void;
    
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolveFn = resolve;
            this.rejectFn = reject;
        });
    }

    resolve(result: T) {
        this.resolveFn!(result);
    }

    reject(reason: unknown) {
        this.rejectFn!(reason);
    }

}
