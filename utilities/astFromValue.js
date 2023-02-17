'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.astFromValue = void 0;
const inspect_js_1 = require('../jsutils/inspect.js');
const invariant_js_1 = require('../jsutils/invariant.js');
const isIterableObject_js_1 = require('../jsutils/isIterableObject.js');
const isObjectLike_js_1 = require('../jsutils/isObjectLike.js');
const kinds_js_1 = require('../language/kinds.js');
const definition_js_1 = require('../type/definition.js');
const scalars_js_1 = require('../type/scalars.js');
/**
 * Produces a GraphQL Value AST given a JavaScript object.
 * Function will match JavaScript/JSON values to GraphQL AST schema format
 * by using suggested GraphQLInputType. For example:
 *
 *     astFromValue("value", GraphQLString)
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * JavaScript values.
 *
 * | JSON Value    | GraphQL Value        |
 * | ------------- | -------------------- |
 * | Object        | Input Object         |
 * | Array         | List                 |
 * | Boolean       | Boolean              |
 * | String        | String / Enum Value  |
 * | Number        | Int / Float          |
 * | Unknown       | Enum Value           |
 * | null          | NullValue            |
 *
 */
function astFromValue(value, type) {
  if ((0, definition_js_1.isNonNullType)(type)) {
    const astValue = astFromValue(value, type.ofType);
    if (astValue?.kind === kinds_js_1.Kind.NULL) {
      return null;
    }
    return astValue;
  }
  // only explicit null, not undefined, NaN
  if (value === null) {
    return { kind: kinds_js_1.Kind.NULL };
  }
  // undefined
  if (value === undefined) {
    return null;
  }
  // Convert JavaScript array to GraphQL list. If the GraphQLType is a list, but
  // the value is not an array, convert the value using the list's item type.
  if ((0, definition_js_1.isListType)(type)) {
    const itemType = type.ofType;
    if ((0, isIterableObject_js_1.isIterableObject)(value)) {
      const valuesNodes = [];
      for (const item of value) {
        const itemNode = astFromValue(item, itemType);
        if (itemNode != null) {
          valuesNodes.push(itemNode);
        }
      }
      return { kind: kinds_js_1.Kind.LIST, values: valuesNodes };
    }
    return astFromValue(value, itemType);
  }
  // Populate the fields of the input object by creating ASTs from each value
  // in the JavaScript object according to the fields in the input type.
  if ((0, definition_js_1.isInputObjectType)(type)) {
    if (!(0, isObjectLike_js_1.isObjectLike)(value)) {
      return null;
    }
    const fieldNodes = [];
    for (const field of Object.values(type.getFields())) {
      const fieldValue = astFromValue(value[field.name], field.type);
      if (fieldValue) {
        fieldNodes.push({
          kind: kinds_js_1.Kind.OBJECT_FIELD,
          name: { kind: kinds_js_1.Kind.NAME, value: field.name },
          value: fieldValue,
        });
      }
    }
    return { kind: kinds_js_1.Kind.OBJECT, fields: fieldNodes };
  }
  if ((0, definition_js_1.isLeafType)(type)) {
    // Since value is an internally represented value, it must be serialized
    // to an externally represented value before converting into an AST.
    const serialized = type.serialize(value);
    if (serialized == null) {
      return null;
    }
    // Others serialize based on their corresponding JavaScript scalar types.
    if (typeof serialized === 'boolean') {
      return { kind: kinds_js_1.Kind.BOOLEAN, value: serialized };
    }
    // JavaScript numbers can be Int or Float values.
    if (typeof serialized === 'number' && Number.isFinite(serialized)) {
      const stringNum = String(serialized);
      return integerStringRegExp.test(stringNum)
        ? { kind: kinds_js_1.Kind.INT, value: stringNum }
        : { kind: kinds_js_1.Kind.FLOAT, value: stringNum };
    }
    if (typeof serialized === 'string') {
      // Enum types use Enum literals.
      if ((0, definition_js_1.isEnumType)(type)) {
        return { kind: kinds_js_1.Kind.ENUM, value: serialized };
      }
      // ID types can use Int literals.
      if (
        type === scalars_js_1.GraphQLID &&
        integerStringRegExp.test(serialized)
      ) {
        return { kind: kinds_js_1.Kind.INT, value: serialized };
      }
      return {
        kind: kinds_js_1.Kind.STRING,
        value: serialized,
      };
    }
    throw new TypeError(
      `Cannot convert value to AST: ${(0, inspect_js_1.inspect)(serialized)}.`,
    );
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.
  false ||
    (0, invariant_js_1.invariant)(
      false,
      'Unexpected input type: ' + (0, inspect_js_1.inspect)(type),
    );
}
exports.astFromValue = astFromValue;
/**
 * IntValue:
 *   - NegativeSign? 0
 *   - NegativeSign? NonZeroDigit ( Digit+ )?
 */
const integerStringRegExp = /^-?(?:0|[1-9][0-9]*)$/;
