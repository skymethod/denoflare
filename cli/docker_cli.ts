import { checkMatches } from '../common/check.ts';
import { basename, dirname, resolve } from './deps_cli.ts';
import { fileExists } from './fs_util.ts';

export async function dockerBuild(dockerfile: string, { tag, dockerBin = 'docker', otherTags = [] }: { tag: string, dockerBin?: string, otherTags?: string[] }): Promise<{ digest: string }> {
    const dockerfilePath = resolve(dockerfile);
    if (!await fileExists(dockerfilePath)) throw new Error(`dockerfile does not exist: ${dockerfilePath}`);
    const dockerfileBasename = basename(dockerfilePath);
    const dockerfileDirname = dirname(dockerfilePath);

    {
        const output = await new Deno.Command(dockerBin, {
            args: [ 
                'build',
                '--platform', 'linux/amd64',
                '-f', dockerfileBasename,
                '--provenance', 'false',
                '--tag', tag,
                ...(otherTags.flatMap(v => [ '--tag', v ])),
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
            args: [ 
                'images',
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

export async function dockerPush(image: string, { dockerBin = 'docker' }: { dockerBin?: string } = {}) {
    const output = await new Deno.Command(dockerBin, {
        args: [ 
            'image',
            'push',
            image
        ],
        stdout: 'piped',
        stdin: 'piped',
    }).spawn().output();

    if (!output.success) throw new Error(`Docker push failed`);
}

export async function dockerLogin({ username, password, host, dockerBin = 'docker' }: { username: string, password: string, host: string, dockerBin?: string }) {
    const p = new Deno.Command(dockerBin, {
        args: [ 
            'login',
            '--username', username,
            '--password-stdin',
            host
        ],
        stdin: 'piped',
        stdout: 'null',
    }).spawn();
    const w = p.stdin.getWriter();
    await w.write(new TextEncoder().encode(password));
    await w.close();
    const output = await p.output();
    if (!output.success) throw new Error(`Docker login failed`);
}
