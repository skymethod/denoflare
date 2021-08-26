export function setSubtract<T>(lhs: ReadonlySet<T>, rhs: ReadonlySet<T>): Set<T> {
    const rt = new Set(lhs);
    for (const item of rhs) {
        rt.delete(item);
    }
    return rt;
}

export function setUnion<T>(lhs: ReadonlySet<T>, rhs: ReadonlySet<T>): Set<T> {
    const rt = new Set(lhs);
    for (const item of rhs) {
        rt.add(item);
    }
    return rt;
}

export function setEqual<T>(lhs: ReadonlySet<T>, rhs: ReadonlySet<T>): boolean {
    return lhs.size === rhs.size && [...lhs].every(v => rhs.has(v));
}
