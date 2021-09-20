import { basename, dirname, globToRegExp, join, walk } from './deps_cli.ts';
import { computeFileInfoVersion, directoryExists, fileExists } from './fs_util.ts';

export class RepoDir {
    static VERBOSE = false;

    readonly path: string;

    private watcher?: Deno.FsWatcher;
    private skipper?: Skipper;
    private skipperVersion?: string;

    private constructor(path: string) {
        this.path = path;
    }

    startWatching(handler: RepoFileEventHandler) {
        if (this.watcher) throw new Error(`Already watching!`);
        this.watcher = Deno.watchFs(this.path);
        this.processEvents(this.watcher, handler).catch(e => {
            console.error(`Error processing fs watcher events`, e.stack || e);
        });
    }

    static async of(path: string): Promise<RepoDir> {
        if (!await directoryExists(path)) throw new Error(`Bad repoDir path: ${path}, directory must exist`);
        return new RepoDir(path);
    }

    async listFiles(opts: { stat?: boolean } = {}): Promise<readonly RepoFileEntry[]> {
        const { stat } = opts;
        const { skip, shouldSkipName } = await this.ensureSkipper();
        const rt: RepoFileEntry[] = [];
        for await (const entry of walk(this.path, { skip })) {
            if (!entry.isFile) continue;
            const { path, name } = entry;
            if (shouldSkipName(name)) continue;
            const info = stat ? await Deno.stat(path) : undefined;
            rt.push({ path, info });
        }
        return rt;
    }

    //

    async processEvents(watcher: Deno.FsWatcher, handler: RepoFileEventHandler) {
        console.log('Watching for file system events...');
        const gitignoreFile = join(this.path, '.gitignore'); 

        for await (const { kind, paths } of watcher) {
            const time = Date.now();
            let skipper = await this.ensureSkipper();
            if (kind === 'modify' || kind === 'create' || kind === 'remove') {
                if (paths.includes(gitignoreFile)) {
                    const exists = await fileExists(gitignoreFile);
                    const skipperVersion = exists ? computeFileInfoVersion(await Deno.stat(gitignoreFile)) : '';
                    if (this.skipperVersion && skipperVersion !== this.skipperVersion) {
                        if (RepoDir.VERBOSE) console.log('RepoDir: invalidating skipper');
                        this.skipper = undefined;
                        this.skipperVersion = undefined;
                    }
                }
                skipper = await this.ensureSkipper();
                const events: RepoFileEvent[] = [];
                for (const path of paths) {
                    if (skipper.shouldSkipPath(path)) continue;
                    const name = basename(path);
                    if (skipper.shouldSkipName(name)) continue;
                    events.push({ kind, path });
                }
                if (events.length > 0) {
                    handler(events);
                }
            } else {
                console.log(`Unhandled`, { time, kind, paths });
            }
         }
    }

    async ensureSkipper(): Promise<Skipper> {
        if (!this.skipper) {
            const gitignoreFile = join(this.path, '.gitignore'); 
            const exists = await fileExists(gitignoreFile);
            const ignoreEntries = exists ? await loadGitignore(gitignoreFile, this.path) : [];
            this.skipper = makeSkipper(this.path, ignoreEntries);
            this.skipperVersion = exists ? computeFileInfoVersion(await Deno.stat(gitignoreFile)) : '';
        }
        return this.skipper;
    }

}

export interface RepoFileEntry {
    readonly path: string;
    readonly info?: Deno.FileInfo;
}

export interface RepoFileEvent {
    readonly kind: 'create' | 'modify' | 'remove';
    readonly path: string;
}

export type RepoFileEventHandler = (events: RepoFileEvent[]) => void;

//

interface Skipper {
    readonly skip: RegExp[];
    shouldSkipName(name: string): boolean;
    shouldSkipPath(path: string): boolean;
}

//

async function loadGitignore(gitignoreFile: string, repoDir: string): Promise<GitignoreEntry[]> {
    const rt: GitignoreEntry[] = [];
    // https://git-scm.com/docs/gitignore
    const contents = await Deno.readTextFile(gitignoreFile);
    for (const line of contents.split(/[\r\n]/).map(v => v.trim())) {
        if (line === '' || line.startsWith('#')) continue;
        const i = line.indexOf('/');
        const anyLevel = i < 0 || i === (line.length - 1);
        const regex = globToRegExp(anyLevel ? line : join(repoDir, line));
        rt.push({ regex, anyLevel });
    }
    return rt;
}

function makeSkipper(repoDir: string, ignoreEntries: GitignoreEntry[]): Skipper {
    if (RepoDir.VERBOSE) console.log('RepoDir: make skipper');
    const skip = [
        globToRegExp(join(repoDir, '.git')),
        globToRegExp(join(repoDir, '.gitignore')),
        ...ignoreEntries.filter(v => !v.anyLevel).map(v => v.regex),
    ];
    const shouldSkipName = (name: string) => ignoreEntries.filter(v => v.anyLevel).some(v => v.regex.test(name));
    const shouldSkipPath = (path: string) => {
        while (path !== repoDir) {
            for (const regex of skip) {
                if (regex.test(path)) return true;
            }
            path = dirname(path);
        }
        return false;
    }
    return { skip, shouldSkipName, shouldSkipPath };
}

//

interface GitignoreEntry {
    readonly regex: RegExp;
    readonly anyLevel: boolean;
}
