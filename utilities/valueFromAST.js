'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.valueFromAST = void 0;
const inspect_js_1 = require('../jsutils/inspect.js');
const invariant_js_1 = require('../jsutils/invariant.js');
const kinds_js_1 = require('../language/kinds.js');
const definition_js_1 = require('../type/definition.js');
/**
 * Produces a JavaScript value given a GraphQL Value AST.
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * GraphQL Value literals.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 *
 * | GraphQL Value        | JSON Value    |
 * | -------------------- | ------------- |
 * | Input Object         | Object        |
 * | List                 | Array         |
 * | Boolean              | Boolean       |
 * | String               | String        |
 * | Int / Float          | Number        |
 * | Enum Value           | Unknown       |
 * | NullValue            | null          |
 *
 */
function valueFromAST(valueNode, type, variables) {
  if (!valueNode) {
    // When there is no node, then there is also no value.
    // Importantly, this is different from returning the value null.
    return;
  }
  if (valueNode.kind === kinds_js_1.Kind.VARIABLE) {
    const variableName = valueNode.name.value;
    if (variables == null || variables[variableName] === undefined) {
      // No valid return value.
      return;
    }
    const variableValue = variables[variableName];
    if (variableValue === null && (0, definition_js_1.isNonNullType)(type)) {
      return; // Invalid: intentionally return no value.
    }
    // Note: This does no further checking that this variable is correct.
    // This assumes that this query has been validated and the variable
    // usage here is of the correct type.
    return variableValue;
  }
  if ((0, definition_js_1.isNonNullType)(type)) {
    if (valueNode.kind === kinds_js_1.Kind.NULL) {
      return; // Invalid: intentionally return no value.
    }
    return valueFromAST(valueNode, type.ofType, variables);
  }
  if (valueNode.kind === kinds_js_1.Kind.NULL) {
    // This is explicitly returning the value null.
    return null;
  }
  if ((0, definition_js_1.isListType)(type)) {
    const itemType = type.ofType;
    if (valueNode.kind === kinds_js_1.Kind.LIST) {
      const coercedValues = [];
      for (const itemNode of valueNode.values) {
        if (isMissingVariable(itemNode, variables)) {
          // If an array contains a missing variable, it is either coerced to
          // null or if the item type is non-null, it considered invalid.
          if ((0, definition_js_1.isNonNullType)(itemType)) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(null);
        } else {
          const itemValue = valueFromAST(itemNode, itemType, variables);
          if (itemValue === undefined) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(itemValue);
        }
      }
      return coercedValues;
    }
    const coercedValue = valueFromAST(valueNode, itemType, variables);
    if (coercedValue === undefined) {
      return; // Invalid: intentionally return no value.
    }
    return [coercedValue];
  }
  if ((0, definition_js_1.isInputObjectType)(type)) {
    if (valueNode.kind !== kinds_js_1.Kind.OBJECT) {
      return; // Invalid: intentionally return no value.
    }
    const coercedObj = Object.create(null);
    const fieldNodes = new Map(
      valueNode.fields.map((field) => [field.name.value, field]),
    );
    for (const field of Object.values(type.getFields())) {
      const fieldNode = fieldNodes.get(field.name);
      if (fieldNode == null || isMissingVariable(fieldNode.value, variables)) {
        if (field.defaultValue !== undefined) {
          coercedObj[field.name] = field.defaultValue;
        } else if ((0, definition_js_1.isNonNullType)(field.type)) {
          return; // Invalid: intentionally return no value.
        }
        continue;
      }
      const fieldValue = valueFromAST(fieldNode.value, field.type, variables);
      if (fieldValue === undefined) {
        return; // Invalid: intentionally return no value.
      }
      coercedObj[field.name] = fieldValue;
    }
    if (type.isOneOf) {
      const keys = Object.keys(coercedObj);
      if (keys.length !== 1) {
        return; // Invalid: not exactly one key, intentionally return no value.
      }
      if (coercedObj[keys[0]] === null) {
        return; // Invalid: value not non-null, intentionally return no value.
      }
    }
    return coercedObj;
  }
  if ((0, definition_js_1.isLeafType)(type)) {
    // Scalars and Enums fulfill parsing a literal value via parseLiteral().
    // Invalid values represent a failure to parse correctly, in which case
    // no value is returned.
    let result;
    try {
      result = type.parseLiteral(valueNode, variables);
    } catch (_error) {
      return; // Invalid: intentionally return no value.
    }
    if (result === undefined) {
      return; // Invalid: intentionally return no value.
    }
    return result;
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible input types have been considered.
  false ||
    (0, invariant_js_1.invariant)(
      false,
      'Unexpected input type: ' + (0, inspect_js_1.inspect)(type),
    );
}
exports.valueFromAST = valueFromAST;
// Returns true if the provided valueNode is a variable which is not defined
// in the set of variables.
function isMissingVariable(valueNode, variables) {
  return (
    valueNode.kind === kinds_js_1.Kind.VARIABLE &&
    (variables == null || variables[valueNode.name.value] === undefined)
  );
}
