import { inspect } from "./inspect.mjs";
export function toError(thrownValue) {
    return thrownValue instanceof Error
        ? thrownValue
        : new NonErrorThrown(thrownValue);
}
class NonErrorThrown extends Error {
    constructor(thrownValue) {
        super('Unexpected error value: ' + inspect(thrownValue));
        this.name = 'NonErrorThrown';
        this.thrownValue = thrownValue;
    }
}
//# sourceMappingURL=toError.mjs.map