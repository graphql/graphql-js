'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.FieldsOnCorrectTypeRule = void 0;
const didYouMean_js_1 = require('../../jsutils/didYouMean.js');
const naturalCompare_js_1 = require('../../jsutils/naturalCompare.js');
const suggestionList_js_1 = require('../../jsutils/suggestionList.js');
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const definition_js_1 = require('../../type/definition.js');
/**
 * Fields on correct type
 *
 * A GraphQL document is only valid if all fields selected are defined by the
 * parent type, or are an allowed meta field such as __typename.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Selections
 */
function FieldsOnCorrectTypeRule(context) {
  return {
    Field(node) {
      const type = context.getParentType();
      if (type) {
        const fieldDef = context.getFieldDef();
        if (!fieldDef) {
          // This field doesn't exist, lets look for suggestions.
          const schema = context.getSchema();
          const fieldName = node.name.value;
          // First determine if there are any suggested types to condition on.
          let suggestion = (0, didYouMean_js_1.didYouMean)(
            'to use an inline fragment on',
            getSuggestedTypeNames(schema, type, fieldName),
          );
          // If there are no suggested types, then perhaps this was a typo?
          if (suggestion === '') {
            suggestion = (0, didYouMean_js_1.didYouMean)(
              getSuggestedFieldNames(type, fieldName),
            );
          }
          // Report an error, including helpful suggestions.
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              `Cannot query field "${fieldName}" on type "${type.name}".` +
                suggestion,
              { nodes: node },
            ),
          );
        }
      }
    },
  };
}
exports.FieldsOnCorrectTypeRule = FieldsOnCorrectTypeRule;
/**
 * Go through all of the implementations of type, as well as the interfaces that
 * they implement. If any of those types include the provided field, suggest them,
 * sorted by how often the type is referenced.
 */
function getSuggestedTypeNames(schema, type, fieldName) {
  if (!(0, definition_js_1.isAbstractType)(type)) {
    // Must be an Object type, which does not have possible fields.
    return [];
  }
  const suggestedTypes = new Set();
  const usageCount = Object.create(null);
  for (const possibleType of schema.getPossibleTypes(type)) {
    if (possibleType.getFields()[fieldName] == null) {
      continue;
    }
    // This object type defines this field.
    suggestedTypes.add(possibleType);
    usageCount[possibleType.name] = 1;
    for (const possibleInterface of possibleType.getInterfaces()) {
      if (possibleInterface.getFields()[fieldName] == null) {
        continue;
      }
      // This interface type defines this field.
      suggestedTypes.add(possibleInterface);
      usageCount[possibleInterface.name] =
        (usageCount[possibleInterface.name] ?? 0) + 1;
    }
  }
  return [...suggestedTypes]
    .sort((typeA, typeB) => {
      // Suggest both interface and object types based on how common they are.
      const usageCountDiff = usageCount[typeB.name] - usageCount[typeA.name];
      if (usageCountDiff !== 0) {
        return usageCountDiff;
      }
      // Suggest super types first followed by subtypes
      if (
        (0, definition_js_1.isInterfaceType)(typeA) &&
        schema.isSubType(typeA, typeB)
      ) {
        return -1;
      }
      if (
        (0, definition_js_1.isInterfaceType)(typeB) &&
        schema.isSubType(typeB, typeA)
      ) {
        return 1;
      }
      return (0, naturalCompare_js_1.naturalCompare)(typeA.name, typeB.name);
    })
    .map((x) => x.name);
}
/**
 * For the field name provided, determine if there are any similar field names
 * that may be the result of a typo.
 */
function getSuggestedFieldNames(type, fieldName) {
  if (
    (0, definition_js_1.isObjectType)(type) ||
    (0, definition_js_1.isInterfaceType)(type)
  ) {
    const possibleFieldNames = Object.keys(type.getFields());
    return (0, suggestionList_js_1.suggestionList)(
      fieldName,
      possibleFieldNames,
    );
  }
  // Otherwise, must be a Union type, which does not define fields.
  return [];
}
