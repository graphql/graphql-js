import { keyValMap } from "../jsutils/keyValMap.mjs";
import { Kind } from "../language/kinds.mjs";
export function valueFromASTUntyped(valueNode, variables) {
    switch (valueNode.kind) {
        case Kind.NULL:
            return null;
        case Kind.INT:
            return parseInt(valueNode.value, 10);
        case Kind.FLOAT:
            return parseFloat(valueNode.value);
        case Kind.STRING:
        case Kind.ENUM:
        case Kind.BOOLEAN:
            return valueNode.value;
        case Kind.LIST:
            return valueNode.values.map((node) => valueFromASTUntyped(node, variables));
        case Kind.OBJECT:
            return keyValMap(valueNode.fields, (field) => field.name.value, (field) => valueFromASTUntyped(field.value, variables));
        case Kind.VARIABLE:
            return variables?.[valueNode.name.value];
    }
}
//# sourceMappingURL=valueFromASTUntyped.mjs.map