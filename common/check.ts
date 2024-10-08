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

export function checkEqual<T>(name: string, value: T, expected: T) {
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

// deno-lint-ignore no-explicit-any
export function isStringRecord(obj: any): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}

export function isOptionalString(obj: unknown): obj is string | undefined {
    return obj === undefined || typeof obj === 'string';
}

export function isOptionalBoolean(obj: unknown): obj is boolean | undefined {
    return obj === undefined || typeof obj === 'boolean';
}

export function isOptional<T>(obj: unknown, validator: (obj: unknown) => obj is T): obj is T | undefined {
    return obj === undefined || validator(obj);
}

export function tryParseUrl(url: string): URL | undefined {
    try {
        return new URL(url);
    } catch {
        return undefined;
    }
}

export function isValidUrl(url: string): boolean {
    return tryParseUrl(url) !== undefined;
}

export function isValidUuid(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(str);
}
