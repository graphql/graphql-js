import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import type { Maybe } from '../jsutils/Maybe.js';

import type { ConstObjectFieldNode, ConstValueNode } from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import type { GraphQLInputType } from '../type/definition.js';
import {
  isEnumType,
  isInputObjectType,
  isLeafType,
  isListType,
  isNonNullType,
} from '../type/definition.js';
import { GraphQLID } from '../type/scalars.js';

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
 * @deprecated use `valueToLiteral()` instead with care to operate on external values - `astFromValue()` will be removed in v18
 */
export function astFromValue(
  value: unknown,
  type: GraphQLInputType,
): Maybe<ConstValueNode> {
  if (isNonNullType(type)) {
    const astValue = astFromValue(value, type.ofType);
    if (astValue?.kind === Kind.NULL) {
      return null;
    }
    return astValue;
  }

  // only explicit null, not undefined, NaN
  if (value === null) {
    return { kind: Kind.NULL };
  }

  // undefined
  if (value === undefined) {
    return null;
  }

  // Convert JavaScript array to GraphQL list. If the GraphQLType is a list, but
  // the value is not an array, convert the value using the list's item type.
  if (isListType(type)) {
    const itemType = type.ofType;
    if (isIterableObject(value)) {
      const valuesNodes = [];
      for (const item of value) {
        const itemNode = astFromValue(item, itemType);
        if (itemNode != null) {
          valuesNodes.push(itemNode);
        }
      }
      return { kind: Kind.LIST, values: valuesNodes };
    }
    return astFromValue(value, itemType);
  }

  // Populate the fields of the input object by creating ASTs from each value
  // in the JavaScript object according to the fields in the input type.
  if (isInputObjectType(type)) {
    if (!isObjectLike(value)) {
      return null;
    }
    const fieldNodes: Array<ConstObjectFieldNode> = [];
    for (const field of Object.values(type.getFields())) {
      const fieldValue = astFromValue(value[field.name], field.type);
      if (fieldValue) {
        fieldNodes.push({
          kind: Kind.OBJECT_FIELD,
          name: { kind: Kind.NAME, value: field.name },
          value: fieldValue,
        });
      }
    }
    return { kind: Kind.OBJECT, fields: fieldNodes };
  }

  if (isLeafType(type)) {
    // Since value is an internally represented value, it must be coerced
    // to an externally represented value before converting into an AST.
    const coerced = type.coerceOutputValue(value);
    if (coerced == null) {
      return null;
    }

    // Others coerce based on their corresponding JavaScript scalar types.
    if (typeof coerced === 'boolean') {
      return { kind: Kind.BOOLEAN, value: coerced };
    }

    // JavaScript numbers can be Int or Float values.
    if (typeof coerced === 'number' && Number.isFinite(coerced)) {
      const stringNum = String(coerced);
      return integerStringRegExp.test(stringNum)
        ? { kind: Kind.INT, value: stringNum }
        : { kind: Kind.FLOAT, value: stringNum };
    }

    if (typeof coerced === 'string') {
      // Enum types use Enum literals.
      if (isEnumType(type)) {
        return { kind: Kind.ENUM, value: coerced };
      }

      // ID types can use Int literals.
      if (type === GraphQLID && integerStringRegExp.test(coerced)) {
        return { kind: Kind.INT, value: coerced };
      }

      return {
        kind: Kind.STRING,
        value: coerced,
      };
    }

    throw new TypeError(`Cannot convert value to AST: ${inspect(coerced)}.`);
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.
  invariant(false, 'Unexpected input type: ' + inspect(type));
}

/**
 * IntValue:
 *   - NegativeSign? 0
 *   - NegativeSign? NonZeroDigit ( Digit+ )?
 */
const integerStringRegExp = /^-?(?:0|[1-9][0-9]*)$/;
