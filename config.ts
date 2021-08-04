
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

export type Binding = TextBinding | SecretBinding | KVNamespaceBinding | DONamespaceBinding;

export interface TextBinding {
    value: string;
}

export interface SecretBinding {
    secret: string;
}

export interface KVNamespaceBinding {
    kvNamespace: string;
}

export interface DONamespaceBinding {
    doNamespace: string;
}

export interface Script {
    readonly path: string;
    readonly bindings: Record<string, Binding>;
}

export interface Config {
    readonly scripts: Record<string, Script>;
}
