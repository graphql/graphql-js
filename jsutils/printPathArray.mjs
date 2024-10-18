/**
 * Build a string describing the path.
 */
export function printPathArray(path) {
    if (path.length === 0) {
        return '';
    }
    return ` at ${path
        .map((key) => (typeof key === 'number' ? `[${key}]` : `.${key}`))
        .join('')}`;
}
//# sourceMappingURL=printPathArray.js.map