export function invariant(condition, message) {
    if (!condition) {
        throw new Error(message ?? 'Unexpected invariant triggered.');
    }
}
//# sourceMappingURL=invariant.js.map