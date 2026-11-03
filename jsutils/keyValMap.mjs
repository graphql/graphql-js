export function keyValMap(list, keyFn, valFn) {
    const result = Object.create(null);
    for (const item of list) {
        result[keyFn(item)] = valFn(item);
    }
    return result;
}
//# sourceMappingURL=keyValMap.mjs.map