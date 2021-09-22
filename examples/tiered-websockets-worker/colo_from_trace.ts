export class ColoFromTrace {

    private _colo: string | undefined;

    async get(): Promise<string> {
        if (!this._colo) {
            this._colo = await this.computeColo();
        }
        return this._colo;
    }

    //
    
    private async computeColo(): Promise<string> {
        const res = await fetch('https://1.1.1.1/cdn-cgi/trace');
        if (res.status !== 200) return res.status.toString();
        const text = await res.text();
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('colo=')) return line.substring('colo='.length);
        }
        return 'nocolo';
    }

}
