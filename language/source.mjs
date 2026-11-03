import { devAssert } from "../jsutils/devAssert.mjs";
import { instanceOf } from "../jsutils/instanceOf.mjs";
const sourceSymbol = Symbol('Source');
export class Source {
    constructor(body, name = 'GraphQL request', locationOffset = { line: 1, column: 1 }) {
        this.__kind = sourceSymbol;
        this.body = body;
        this.name = name;
        this.locationOffset = locationOffset;
        if (!(this.locationOffset.line > 0))
            devAssert(false, 'line in locationOffset is 1-indexed and must be positive.');
        if (!(this.locationOffset.column > 0))
            devAssert(false, 'column in locationOffset is 1-indexed and must be positive.');
    }
    get [Symbol.toStringTag]() {
        return 'Source';
    }
}
export function isSource(source) {
    return instanceOf(source, sourceSymbol, Source);
}
//# sourceMappingURL=source.mjs.map