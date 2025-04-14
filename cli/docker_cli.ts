import { checkMatches } from '../common/check.ts';
import { basename, dirname, resolve } from './deps_cli.ts';
import { fileExists } from './fs_util.ts';

export async function dockerBuild(dockerfile: string, { tag, dockerBin = 'docker' }: { tag: string, dockerBin?: string }): Promise<{ digest: string }> {
    const dockerfilePath = resolve(dockerfile);
    if (!await fileExists(dockerfilePath)) throw new Error(`dockerfile does not exist: ${dockerfilePath}`);
    const dockerfileBasename = basename(dockerfilePath);
    const dockerfileDirname = dirname(dockerfilePath);

    {
        const output = await new Deno.Command(dockerBin, {
            args: [ 'build',
                '--platform', 'linux/amd64',
                '-f', dockerfileBasename,
                '--provenance', 'false',
                '--tag', tag,
                '.'
            ],
            cwd: dockerfileDirname,
            stdout: 'piped',
            stdin: 'piped',
        }).spawn().output();

        if (!output.success) throw new Error(`Docker build failed`);
    }

    {
        const output = await new Deno.Command(dockerBin, {
            args: [ 'images',
                '--no-trunc',
                '--quiet',
                tag
            ],
        }).output();
        if (!output.success) throw new Error(`Docker images failed`);

        const digest = new TextDecoder().decode(output.stdout).trim();
        checkMatches('digest', digest, /^sha256:[0-9a-f]{64}$/);
        return { digest };
    }

}
