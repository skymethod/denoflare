import { computeDenoGraphLocalPaths } from './deno_graph.ts';

export class ModuleWatcher {
    static VERBOSE = false;

    private readonly entryPointPath: string;
    private readonly modificationCallback: () => void;

    private watcher: Deno.FsWatcher | undefined;

    constructor(entryPointPath: string, modificationCallback: () => void) {
        this.entryPointPath = entryPointPath;
        this.modificationCallback = modificationCallback;
        this.initWatcher().catch(e => console.error('Error in initWatcher', e));
    }

    close() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = undefined;
        }
    }

    //

    private dispatchModification() {
        this.modificationCallback();
    }

    private async initWatcher() {
        const paths = await computeDenoGraphLocalPaths(this.entryPointPath);
        if (ModuleWatcher.VERBOSE) console.log('watching', paths);
        const watcher = Deno.watchFs(paths);
        this.watcher = watcher;
        let timeoutId: number | undefined;
        for await (const event of watcher) {
            if (event.kind === 'modify') {
                // a single file modification sends two modify events, so coalesce them
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => this.dispatchModification(), 500);
            }
        }
    }

}
