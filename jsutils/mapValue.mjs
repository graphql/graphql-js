export function mapValue(map, fn) {
    const result = Object.create(null);
    for (const key of Object.keys(map)) {
        result[key] = fn(map[key], key);
    }
    return result;
}
//# sourceMappingURL=mapValue.mjs.map