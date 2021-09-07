// deno-lint-ignore no-explicit-any
export function checkObject(name: string, value: any): value is Record<string, unknown> {
    if (typeof value !== 'object') throw new Error(`Bad ${name}: expected object, found ${typeof value}`);
    if (Array.isArray(value)) throw new Error(`Bad ${name}: expected object, found array`);
    if (value === null) throw new Error(`Bad ${name}: expected object, found null`);
    return value;
}
