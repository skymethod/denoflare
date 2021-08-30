
export function isTextBinding(binding: Binding): binding is TextBinding {
    // deno-lint-ignore no-explicit-any
    return typeof (binding as any).value === 'string';
}

export function isSecretBinding(binding: Binding): binding is SecretBinding {
    // deno-lint-ignore no-explicit-any
    return typeof (binding as any).secret === 'string';
}

export function isKVNamespaceBinding(binding: Binding): binding is KVNamespaceBinding {
    // deno-lint-ignore no-explicit-any
    return typeof (binding as any).kvNamespace === 'string';
}

export function isDONamespaceBinding(binding: Binding): binding is DONamespaceBinding {
    // deno-lint-ignore no-explicit-any
    return typeof (binding as any).doNamespace === 'string';
}

//

export interface Config {
    readonly scripts?: Record<string, Script>;
    readonly profiles?: Record<string, Profile>;
}

export type Isolation = 'none' | 'isolate';

export interface Script {
    readonly path: string;
    readonly bindings: Record<string, Binding>;
    readonly localPort?: number;
    readonly localHostname?: string;
    readonly localIsolation?: Isolation;
    readonly profile?: string;
}

export type Binding = TextBinding | SecretBinding | KVNamespaceBinding | DONamespaceBinding;

export interface TextBinding {
    readonly value: string;
}

export interface SecretBinding {
    readonly secret: string;
}

export interface KVNamespaceBinding {
    readonly kvNamespace: string;
}

export interface DONamespaceBinding {
    readonly doNamespace: string;
}

export interface Profile {
    readonly accountId: string;
    readonly apiToken: string;
    readonly default?: boolean;
}
