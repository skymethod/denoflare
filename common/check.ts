// deno-lint-ignore no-explicit-any
export function checkObject(name: string, value: any): value is Record<string, unknown> {
    if (typeof value !== 'object') throw new Error(`Bad ${name}: expected object, found ${typeof value}`);
    if (Array.isArray(value)) throw new Error(`Bad ${name}: expected object, found array`);
    if (value === null) throw new Error(`Bad ${name}: expected object, found null`);
    return true;
}

// deno-lint-ignore no-explicit-any
export function checkString(name: string, value: any): string {
    if (typeof value !== 'string') throw new Error(`Bad ${name}: expected string, found ${typeof value}`);
    return value;
}
