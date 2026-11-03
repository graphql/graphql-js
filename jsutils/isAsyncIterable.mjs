export function isAsyncIterable(maybeAsyncIterable) {
    return typeof maybeAsyncIterable?.[Symbol.asyncIterator] === 'function';
}
//# sourceMappingURL=isAsyncIterable.mjs.map