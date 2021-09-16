import { globToRegExp, join, walk } from './deps_cli.ts';
import { directoryExists, fileExists } from './fs_util.ts';

export class RepoDir {
    readonly path: string;

    private constructor(path: string) {
        this.path = path;
    }

    static async of(path: string): Promise<RepoDir> {
        if (!await directoryExists(path)) throw new Error(`Bad repoDir path: ${path}, directory must exist`);
        return new RepoDir(path);
    }

    async listFiles(opts: { stat?: boolean } = {}): Promise<readonly RepoFileEntry[]> {
        const { stat } = opts;
        const ignoreEntries = await loadGitignore(this.path);
        const skip: RegExp[] = [
            globToRegExp(join(this.path, '.git')),
            globToRegExp(join(this.path, '.gitignore')),
            ...ignoreEntries.filter(v => !v.anyLevel).map(v => v.regex),
        ];
        const rt: RepoFileEntry[] = [];
        for await (const entry of walk(this.path, { skip })) {
            if (!entry.isFile) continue;
            const { path, name } = entry;
            if (ignoreEntries.filter(v => v.anyLevel).some(v => v.regex.test(name))) continue;
            const info = stat ? await Deno.stat(path) : undefined;
            rt.push({ path, info });
        }
        return rt;
    }

}

export interface RepoFileEntry {
    readonly path: string;
    readonly info?: Deno.FileInfo;
}

//

async function loadGitignore(repoDir: string): Promise<GitignoreEntry[]> {
    const rt: GitignoreEntry[] = [];
    // https://git-scm.com/docs/gitignore
    const gitignoreFile = join(repoDir, '.gitignore'); 
    if (await fileExists(gitignoreFile)) {
        const contents = await Deno.readTextFile(gitignoreFile);
        for (const line of contents.split(/[\r\n]/).map(v => v.trim())) {
            if (line === '' || line.startsWith('#')) continue;
            const i = line.indexOf('/');
            const anyLevel = i < 0 || i === (line.length - 1);
            const regex = globToRegExp(anyLevel ? line : join(repoDir, line));
            rt.push({ regex, anyLevel });
        }
    }
    return rt;
}

//

interface GitignoreEntry {
    readonly regex: RegExp;
    readonly anyLevel: boolean;
}
