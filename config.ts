export async function loadConfig(): Promise<Config> {
    const config = JSON.parse(await Deno.readTextFile(`${Deno.env.get('HOME')}/.denoflare`));
    return config as Config;
}

export function isTextBinding(binding: Binding): binding is TextBinding {
    // deno-lint-ignore no-explicit-any
    return typeof (binding as any).value === 'string';
}

//

type Binding = TextBinding | SecretBinding | KVNamespaceBinding | DONamespaceBinding;

interface TextBinding {
    value: string;
}

interface SecretBinding {
    secret: string;
}

interface KVNamespaceBinding {
    kvNamespace: string;
}

interface DONamespaceBinding {
    doNamespace: string;
}

interface Script {
    readonly path: string;
    readonly bindings: Record<string, Binding>;
}

interface Config {
    readonly scripts: Record<string, Script>;
}
