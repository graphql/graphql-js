export function promiseForObject(object, promiseAll) {
    const keys = Object.keys(object);
    const values = Object.values(object);
    return promiseAll(values).then((resolvedValues) => {
        const resolvedObject = Object.create(null);
        for (let i = 0; i < keys.length; ++i) {
            resolvedObject[keys[i]] = resolvedValues[i];
        }
        return resolvedObject;
    });
}
//# sourceMappingURL=promiseForObject.mjs.map