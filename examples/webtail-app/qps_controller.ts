export interface QpsControllerCallbacks {
    onQpsChanged(qps: number): void;
}

export class QpsController {
    private readonly sortedEventTimes: number[] = [];
    private readonly callbacks: QpsControllerCallbacks;
    private readonly n: number;

    private _qps = 0;
    get qps(): number { return this._qps; }

    constructor(n: number, callbacks: QpsControllerCallbacks) {
        this.callbacks = callbacks;
        this.n = n;
    }

    addEvent(eventTime: number) {
        const qps = computeQps(this.n, this.sortedEventTimes, eventTime);
        if (qps === this._qps) return;
        this._qps = qps;
        this.callbacks.onQpsChanged(qps);
    }

}

//

function computeQps(n: number, sortedEventTimes: number[], eventTime: number) {
    add(eventTime, sortedEventTimes);
    while (sortedEventTimes.length > n) {
        sortedEventTimes.shift();
    }
    // currentAvgRate = (N - 1) / (time difference between last N events)
    const num = sortedEventTimes.length;
    if (num < 2) return 0;
    const timeDiffSeconds = (sortedEventTimes[sortedEventTimes.length - 1] - sortedEventTimes[0]) / 1000;
    return (num - 1) / timeDiffSeconds;
}

function add(el: number, arr: number[]) {
    arr.splice(findLoc(el, arr) + 1, 0, el);
    return arr;
}

function findLoc(el: number, arr: number[], st?: number, en?: number) {
    st = st || 0;
    en = en || arr.length;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] > el) {
            return i - 1;
        }
    }
    return en;
}
