import { isPromiseLike } from "../jsutils/isPromise.mjs";
export function collectIteratorPromises(iterator) {
    const promises = [];
    try {
        while (true) {
            const iteration = iterator.next();
            if (iteration.done) {
                return promises;
            }
            if (isPromiseLike(iteration.value)) {
                promises.push(iteration.value);
            }
        }
    }
    catch {
        return promises;
    }
}
//# sourceMappingURL=collectIteratorPromises.mjs.map