export function addPath(prev, key, typename) {
    return { prev, key, typename };
}
export function pathToArray(path) {
    const flattened = [];
    let curr = path;
    while (curr) {
        flattened.push(curr.key);
        curr = curr.prev;
    }
    return flattened.reverse();
}
//# sourceMappingURL=Path.mjs.map