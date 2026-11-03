import { didYouMean } from "../../jsutils/didYouMean.mjs";
import { inspect } from "../../jsutils/inspect.mjs";
import { invariant } from "../../jsutils/invariant.mjs";
import { suggestionList } from "../../jsutils/suggestionList.mjs";
import { GraphQLError } from "../../error/GraphQLError.mjs";
import { Kind } from "../../language/kinds.mjs";
import { isTypeDefinitionNode } from "../../language/predicates.mjs";
import { isEnumType, isInputObjectType, isInterfaceType, isObjectType, isScalarType, isUnionType, } from "../../type/definition.mjs";
export function PossibleTypeExtensionsRule(context) {
    const schema = context.getSchema();
    const definedTypes = new Map();
    for (const def of context.getDocument().definitions) {
        if (isTypeDefinitionNode(def)) {
            definedTypes.set(def.name.value, def);
        }
    }
    return {
        ScalarTypeExtension: checkExtension,
        ObjectTypeExtension: checkExtension,
        InterfaceTypeExtension: checkExtension,
        UnionTypeExtension: checkExtension,
        EnumTypeExtension: checkExtension,
        InputObjectTypeExtension: checkExtension,
    };
    function checkExtension(node) {
        const typeName = node.name.value;
        const defNode = definedTypes.get(typeName);
        const existingType = schema?.getType(typeName);
        let expectedKind;
        if (defNode != null) {
            expectedKind = defKindToExtKind[defNode.kind];
        }
        else if (existingType) {
            expectedKind = typeToExtKind(existingType);
        }
        if (expectedKind != null) {
            if (expectedKind !== node.kind) {
                const kindStr = extensionKindToTypeName(node.kind);
                context.reportError(new GraphQLError(`Cannot extend non-${kindStr} type "${typeName}".`, {
                    nodes: defNode ? [defNode, node] : node,
                }));
            }
        }
        else {
            const allTypeNames = [
                ...definedTypes.keys(),
                ...Object.keys(schema?.getTypeMap() ?? {}),
            ];
            context.reportError(new GraphQLError(`Cannot extend type "${typeName}" because it is not defined.` +
                didYouMean(suggestionList(typeName, allTypeNames)), { nodes: node.name }));
        }
    }
}
const defKindToExtKind = {
    [Kind.SCALAR_TYPE_DEFINITION]: Kind.SCALAR_TYPE_EXTENSION,
    [Kind.OBJECT_TYPE_DEFINITION]: Kind.OBJECT_TYPE_EXTENSION,
    [Kind.INTERFACE_TYPE_DEFINITION]: Kind.INTERFACE_TYPE_EXTENSION,
    [Kind.UNION_TYPE_DEFINITION]: Kind.UNION_TYPE_EXTENSION,
    [Kind.ENUM_TYPE_DEFINITION]: Kind.ENUM_TYPE_EXTENSION,
    [Kind.INPUT_OBJECT_TYPE_DEFINITION]: Kind.INPUT_OBJECT_TYPE_EXTENSION,
};
function typeToExtKind(type) {
    if (isScalarType(type)) {
        return Kind.SCALAR_TYPE_EXTENSION;
    }
    if (isObjectType(type)) {
        return Kind.OBJECT_TYPE_EXTENSION;
    }
    if (isInterfaceType(type)) {
        return Kind.INTERFACE_TYPE_EXTENSION;
    }
    if (isUnionType(type)) {
        return Kind.UNION_TYPE_EXTENSION;
    }
    if (isEnumType(type)) {
        return Kind.ENUM_TYPE_EXTENSION;
    }
    if (isInputObjectType(type)) {
        return Kind.INPUT_OBJECT_TYPE_EXTENSION;
    }
    invariant(false, 'Unexpected type: ' + inspect(type));
}
function extensionKindToTypeName(kind) {
    switch (kind) {
        case Kind.SCALAR_TYPE_EXTENSION:
            return 'scalar';
        case Kind.OBJECT_TYPE_EXTENSION:
            return 'object';
        case Kind.INTERFACE_TYPE_EXTENSION:
            return 'interface';
        case Kind.UNION_TYPE_EXTENSION:
            return 'union';
        case Kind.ENUM_TYPE_EXTENSION:
            return 'enum';
        case Kind.INPUT_OBJECT_TYPE_EXTENSION:
            return 'input object';
        default:
            invariant(false, 'Unexpected kind: ' + inspect(kind));
    }
}
//# sourceMappingURL=PossibleTypeExtensionsRule.mjs.map