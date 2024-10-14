"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoxedPromiseOrValue = void 0;
const isPromise_js_1 = require("./isPromise.js");
/**
 * A BoxedPromiseOrValue is a container for a value or promise where the value
 * will be updated when the promise resolves.
 *
 * A BoxedPromiseOrValue may only be used with promises whose possible
 * rejection has already been handled, otherwise this will lead to unhandled
 * promise rejections.
 *
 * @internal
 * */
class BoxedPromiseOrValue {
    constructor(value) {
        this.value = value;
        if ((0, isPromise_js_1.isPromise)(value)) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            value.then((resolved) => {
                this.value = resolved;
            });
        }
    }
}
exports.BoxedPromiseOrValue = BoxedPromiseOrValue;
//# sourceMappingURL=BoxedPromiseOrValue.js.map