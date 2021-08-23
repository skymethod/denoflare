// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

// inline just the v4 implementation to cut down on bundle size

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates the UUID v4.
 * @param id UUID value.
 */
export function validateUuid(id: string): boolean {
    return UUID_RE.test(id);
}

/** Generates a RFC4122 v4 UUID (pseudo-randomly-based) */
export function generateUuid(): string {
    // https://wicg.github.io/uuid/
    // deno-lint-ignore no-explicit-any
    const cryptoAsAny = crypto as any;
    if (typeof cryptoAsAny.randomUUID === 'function') {
        return cryptoAsAny.randomUUID();
    }
    
    const rnds = crypto.getRandomValues(new Uint8Array(16));

    rnds[6] = (rnds[6] & 0x0f) | 0x40; // Version 4
    rnds[8] = (rnds[8] & 0x3f) | 0x80; // Variant 10

    return bytesToUuid(rnds);
}

/**
 * Converts the byte array to a UUID string
 * @param bytes Used to convert Byte to Hex
 */
function bytesToUuid(bytes: number[] | Uint8Array): string {
    const bits = [...bytes].map((bit) => {
        const s = bit.toString(16);
        return bit < 0x10 ? "0" + s : s;
    });
    return [
        ...bits.slice(0, 4),
        "-",
        ...bits.slice(4, 6),
        "-",
        ...bits.slice(6, 8),
        "-",
        ...bits.slice(8, 10),
        "-",
        ...bits.slice(10, 16),
    ].join("");
}
