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

// deno-lint-ignore no-explicit-any
export function checkNumber(name: string, value: any): number {
    if (typeof value !== 'number') throw new Error(`Bad ${name}: expected number, found ${typeof value}`);
    return value;
}

// deno-lint-ignore no-explicit-any
export function checkOrigin(name: string, value: any): string {
    if (typeof value !== 'string' || new URL(value).toString() !== new URL(value).origin + '/') throw new Error(`Bad ${name}: ${value}`);
    return value;
}

export function checkEqual(name: string, value: string, expected: string) {
    if (value !== expected) throw new Error(`Bad ${name}: expected ${expected}, found ${value}`);
}

export function checkMatches(name: string, value: string, pattern: RegExp): string {
    if (!pattern.test(value)) throw new Error(`Bad ${name}: ${value}`);
    return value;
}

export function checkMatchesReturnMatcher(name: string, value: string, pattern: RegExp): RegExpExecArray {
    const m = pattern.exec(value);
    if (!m) throw new Error(`Bad ${name}: ${value}`);
    return m;
}

export function check<T>(name: string, value: T, isValid: boolean | ((value: T) => boolean)): asserts isValid {
    const valid = typeof isValid === 'boolean' && isValid || typeof isValid === 'function' && isValid(value);
    if (!valid) throw new Error(`Bad ${name}: ${value}`);
}

//

// deno-lint-ignore no-explicit-any
export function isStringArray(obj: any): obj is string[] {
    return Array.isArray(obj) && obj.every(v => typeof v === 'string');
}
