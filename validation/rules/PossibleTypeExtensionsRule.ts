import { didYouMean } from '../../jsutils/didYouMean.ts';
import { inspect } from '../../jsutils/inspect.ts';
import { invariant } from '../../jsutils/invariant.ts';
import { suggestionList } from '../../jsutils/suggestionList.ts';
import { GraphQLError } from '../../error/GraphQLError.ts';
import type {
  TypeDefinitionNode,
  TypeExtensionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { isTypeDefinitionNode } from '../../language/predicates.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import type { GraphQLNamedType } from '../../type/definition.ts';
import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
} from '../../type/definition.ts';
import type { SDLValidationContext } from '../ValidationContext.ts';
/**
 * Possible type extension
 *
 * A type extension is only valid if the type is defined and has the same kind.
 */
export function PossibleTypeExtensionsRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  const definedTypes = new Map<string, TypeDefinitionNode>();
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
  function checkExtension(node: TypeExtensionNode): void {
    const typeName = node.name.value;
    const defNode = definedTypes.get(typeName);
    const existingType = schema?.getType(typeName);
    let expectedKind: Kind | undefined;
    if (defNode != null) {
      expectedKind = defKindToExtKind[defNode.kind];
    } else if (existingType) {
      expectedKind = typeToExtKind(existingType);
    }
    if (expectedKind != null) {
      if (expectedKind !== node.kind) {
        const kindStr = extensionKindToTypeName(node.kind);
        context.reportError(
          new GraphQLError(`Cannot extend non-${kindStr} type "${typeName}".`, {
            nodes: defNode ? [defNode, node] : node,
          }),
        );
      }
    } else {
      const allTypeNames = [
        ...definedTypes.keys(),
        ...Object.keys(schema?.getTypeMap() ?? {}),
      ];
      const suggestedTypes = suggestionList(typeName, allTypeNames);
      context.reportError(
        new GraphQLError(
          `Cannot extend type "${typeName}" because it is not defined.` +
            didYouMean(suggestedTypes),
          { nodes: node.name },
        ),
      );
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
} as const;
function typeToExtKind(type: GraphQLNamedType): Kind {
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
  /* c8 ignore next 3 */
  // Not reachable. All possible types have been considered
  false || invariant(false, 'Unexpected type: ' + inspect(type));
}
function extensionKindToTypeName(kind: Kind): string {
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
    // Not reachable. All possible types have been considered
    /* c8 ignore next 2 */
    default:
      false || invariant(false, 'Unexpected kind: ' + inspect(kind));
  }
}
