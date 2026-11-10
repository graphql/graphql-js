"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withConcurrentAbruptClose = withConcurrentAbruptClose;
const isPromise_ts_1 = require("../jsutils/isPromise.js");
const asyncDispose = Symbol.asyncDispose ?? Symbol.for('Symbol.asyncDispose');
function withConcurrentAbruptClose(generator, beforeReturn, beforeThrow = beforeReturn) {
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
        if ((0, isPromise_ts_1.isPromiseLike)(result)) {
            return result.then(undefined, () => {
            });
        }
    }
    catch {
    }
}
//# sourceMappingURL=withConcurrentAbruptClose.js.map