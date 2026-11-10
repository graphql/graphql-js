import { isPromiseLike } from "../jsutils/isPromise.mjs";
const asyncDispose = Symbol.asyncDispose ?? Symbol.for('Symbol.asyncDispose');
export function withConcurrentAbruptClose(generator, beforeReturn, beforeThrow = beforeReturn) {
    let completed = false;
    let abruptCloseRequested = false;
    const runAbruptCloseFn = (fn) => {
        if (completed || abruptCloseRequested) {
            return;
        }
        abruptCloseRequested = true;
        return ignoreErrors(fn);
    };
    return {
        [Symbol.asyncIterator]() {
            return this;
        },
        next() {
            const result = generator.next();
            result
                .then((iteration) => {
                if (iteration.done) {
                    completed = true;
                }
            })
                .catch(() => undefined);
            return result;
        },
        async return() {
            await runAbruptCloseFn(beforeReturn);
            return generator.return();
        },
        async throw(error) {
            await runAbruptCloseFn(() => beforeThrow(error));
            return generator.throw(error);
        },
        async [asyncDispose]() {
            await runAbruptCloseFn(beforeReturn);
            if (typeof generator[asyncDispose] === 'function') {
                await generator[asyncDispose]();
            }
        },
    };
}
function ignoreErrors(fn) {
    try {
        const result = fn();
        if (isPromiseLike(result)) {
            return result.then(undefined, () => {
            });
        }
    }
    catch {
    }
}
//# sourceMappingURL=withConcurrentAbruptClose.mjs.map