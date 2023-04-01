'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PossibleTypeExtensionsRule = void 0;
const didYouMean_js_1 = require('../../jsutils/didYouMean.js');
const inspect_js_1 = require('../../jsutils/inspect.js');
const invariant_js_1 = require('../../jsutils/invariant.js');
const suggestionList_js_1 = require('../../jsutils/suggestionList.js');
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const kinds_js_1 = require('../../language/kinds.js');
const predicates_js_1 = require('../../language/predicates.js');
const definition_js_1 = require('../../type/definition.js');
/**
 * Possible type extension
 *
 * A type extension is only valid if the type is defined and has the same kind.
 */
function PossibleTypeExtensionsRule(context) {
  const schema = context.getSchema();
  const definedTypes = new Map();
  for (const def of context.getDocument().definitions) {
    if ((0, predicates_js_1.isTypeDefinitionNode)(def)) {
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
    } else if (existingType) {
      expectedKind = typeToExtKind(existingType);
    }
    if (expectedKind != null) {
      if (expectedKind !== node.kind) {
        const kindStr = extensionKindToTypeName(node.kind);
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Cannot extend non-${kindStr} type "${typeName}".`,
            {
              nodes: defNode ? [defNode, node] : node,
            },
          ),
        );
      }
    } else {
      const allTypeNames = [
        ...definedTypes.keys(),
        ...Object.keys(schema?.getTypeMap() ?? {}),
      ];
      const suggestedTypes = (0, suggestionList_js_1.suggestionList)(
        typeName,
        allTypeNames,
      );
      context.reportError(
        new GraphQLError_js_1.GraphQLError(
          `Cannot extend type "${typeName}" because it is not defined.` +
            (0, didYouMean_js_1.didYouMean)(suggestedTypes),
          { nodes: node.name },
        ),
      );
    }
  }
}
exports.PossibleTypeExtensionsRule = PossibleTypeExtensionsRule;
const defKindToExtKind = {
  [kinds_js_1.Kind.SCALAR_TYPE_DEFINITION]:
    kinds_js_1.Kind.SCALAR_TYPE_EXTENSION,
  [kinds_js_1.Kind.OBJECT_TYPE_DEFINITION]:
    kinds_js_1.Kind.OBJECT_TYPE_EXTENSION,
  [kinds_js_1.Kind.INTERFACE_TYPE_DEFINITION]:
    kinds_js_1.Kind.INTERFACE_TYPE_EXTENSION,
  [kinds_js_1.Kind.UNION_TYPE_DEFINITION]: kinds_js_1.Kind.UNION_TYPE_EXTENSION,
  [kinds_js_1.Kind.ENUM_TYPE_DEFINITION]: kinds_js_1.Kind.ENUM_TYPE_EXTENSION,
  [kinds_js_1.Kind.INPUT_OBJECT_TYPE_DEFINITION]:
    kinds_js_1.Kind.INPUT_OBJECT_TYPE_EXTENSION,
};
function typeToExtKind(type) {
  if ((0, definition_js_1.isScalarType)(type)) {
    return kinds_js_1.Kind.SCALAR_TYPE_EXTENSION;
  }
  if ((0, definition_js_1.isObjectType)(type)) {
    return kinds_js_1.Kind.OBJECT_TYPE_EXTENSION;
  }
  if ((0, definition_js_1.isInterfaceType)(type)) {
    return kinds_js_1.Kind.INTERFACE_TYPE_EXTENSION;
  }
  if ((0, definition_js_1.isUnionType)(type)) {
    return kinds_js_1.Kind.UNION_TYPE_EXTENSION;
  }
  if ((0, definition_js_1.isEnumType)(type)) {
    return kinds_js_1.Kind.ENUM_TYPE_EXTENSION;
  }
  if ((0, definition_js_1.isInputObjectType)(type)) {
    return kinds_js_1.Kind.INPUT_OBJECT_TYPE_EXTENSION;
  }
  /* c8 ignore next 3 */
  // Not reachable. All possible types have been considered
  false ||
    (0, invariant_js_1.invariant)(
      false,
      'Unexpected type: ' + (0, inspect_js_1.inspect)(type),
    );
}
function extensionKindToTypeName(kind) {
  switch (kind) {
    case kinds_js_1.Kind.SCALAR_TYPE_EXTENSION:
      return 'scalar';
    case kinds_js_1.Kind.OBJECT_TYPE_EXTENSION:
      return 'object';
    case kinds_js_1.Kind.INTERFACE_TYPE_EXTENSION:
      return 'interface';
    case kinds_js_1.Kind.UNION_TYPE_EXTENSION:
      return 'union';
    case kinds_js_1.Kind.ENUM_TYPE_EXTENSION:
      return 'enum';
    case kinds_js_1.Kind.INPUT_OBJECT_TYPE_EXTENSION:
      return 'input object';
    // Not reachable. All possible types have been considered
    /* c8 ignore next 2 */
    default:
      false ||
        (0, invariant_js_1.invariant)(
          false,
          'Unexpected kind: ' + (0, inspect_js_1.inspect)(kind),
        );
  }
}
