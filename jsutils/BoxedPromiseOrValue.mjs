import { isPromise } from "./isPromise.mjs";
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
export class BoxedPromiseOrValue {
    constructor(value) {
        this.value = value;
        if (isPromise(value)) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            value.then((resolved) => {
                this.value = resolved;
            });
        }
    }
}
//# sourceMappingURL=BoxedPromiseOrValue.js.map