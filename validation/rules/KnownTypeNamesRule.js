'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.KnownTypeNamesRule = void 0;
const didYouMean_js_1 = require('../../jsutils/didYouMean.js');
const suggestionList_js_1 = require('../../jsutils/suggestionList.js');
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const predicates_js_1 = require('../../language/predicates.js');
const introspection_js_1 = require('../../type/introspection.js');
const scalars_js_1 = require('../../type/scalars.js');
/**
 * Known type names
 *
 * A GraphQL document is only valid if referenced types (specifically
 * variable definitions and fragment conditions) are defined by the type schema.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Spread-Type-Existence
 */
function KnownTypeNamesRule(context) {
  const { definitions } = context.getDocument();
  const existingTypesMap = context.getSchema()?.getTypeMap() ?? {};
  const typeNames = new Set([
    ...Object.keys(existingTypesMap),
    ...definitions
      .filter(predicates_js_1.isTypeDefinitionNode)
      .map((def) => def.name.value),
  ]);
  return {
    NamedType(node, _1, parent, _2, ancestors) {
      const typeName = node.name.value;
      if (!typeNames.has(typeName)) {
        const definitionNode = ancestors[2] ?? parent;
        const isSDL = definitionNode != null && isSDLNode(definitionNode);
        if (isSDL && standardTypeNames.has(typeName)) {
          return;
        }
        const suggestedTypes = (0, suggestionList_js_1.suggestionList)(
          typeName,
          isSDL ? [...standardTypeNames, ...typeNames] : [...typeNames],
        );
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Unknown type "${typeName}".` +
              (0, didYouMean_js_1.didYouMean)(suggestedTypes),
            { nodes: node },
          ),
        );
      }
    },
  };
}
exports.KnownTypeNamesRule = KnownTypeNamesRule;
const standardTypeNames = new Set(
  [
    ...scalars_js_1.specifiedScalarTypes,
    ...introspection_js_1.introspectionTypes,
  ].map((type) => type.name),
);
function isSDLNode(value) {
  return (
    'kind' in value &&
    ((0, predicates_js_1.isTypeSystemDefinitionNode)(value) ||
      (0, predicates_js_1.isTypeSystemExtensionNode)(value))
  );
}
