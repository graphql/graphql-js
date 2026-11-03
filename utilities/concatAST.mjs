import { Kind } from "../language/kinds.mjs";
export function concatAST(documents) {
    const definitions = [];
    for (const doc of documents) {
        definitions.push(...doc.definitions);
    }
    return { kind: Kind.DOCUMENT, definitions };
}
//# sourceMappingURL=concatAST.mjs.map