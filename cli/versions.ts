export function versionCompare(lhs: string, rhs: string): number {
    if (lhs === rhs) return 0;
    const lhsTokens = lhs.split('.');
    const rhsTokens = rhs.split('.');
    for (let i = 0; i < Math.max(lhsTokens.length, rhsTokens.length); i++) {
        const lhsNum = parseInt(lhsTokens[i] ?? '0');
        const rhsNum = parseInt(rhsTokens[i] ?? '0');
        if (lhsNum < rhsNum) return -1;
        if (lhsNum > rhsNum) return 1;
    }
    return 0;
}
