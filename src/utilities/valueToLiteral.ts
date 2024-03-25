import { inspect } from '../jsutils/inspect.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';

import type { ConstObjectFieldNode, ConstValueNode } from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import type { GraphQLInputType } from '../type/definition.js';
import {
  assertLeafType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isRequiredInputField,
} from '../type/definition.js';

/**
 * Produces a GraphQL Value AST given a JavaScript value and a GraphQL type.
 *
 * Scalar types are converted by calling the `valueToLiteral` method on that
 * type, otherwise the default scalar `valueToLiteral` method is used, defined
 * below.
 *
 * The provided value is an non-coerced "input" value. This function does not
 * perform any coercion, however it does perform validation. Provided values
 * which are invalid for the given type will result in an `undefined` return
 * value.
 */
export function valueToLiteral(
  value: unknown,
  type: GraphQLInputType,
): ConstValueNode | undefined {
  if (isNonNullType(type)) {
    if (value == null) {
      return; // Invalid: intentionally return no value.
    }
    return valueToLiteral(value, type.ofType);
  }

  // Like JSON, a null literal is produced for both null and undefined.
  if (value == null) {
    return { kind: Kind.NULL };
  }

  if (isListType(type)) {
    if (!isIterableObject(value)) {
      return valueToLiteral(value, type.ofType);
    }
    const values: Array<ConstValueNode> = [];
    for (const itemValue of value) {
      const itemNode = valueToLiteral(itemValue, type.ofType);
      if (!itemNode) {
        return; // Invalid: intentionally return no value.
      }
      values.push(itemNode);
    }
    return { kind: Kind.LIST, values };
  }

  if (isInputObjectType(type)) {
    if (!isObjectLike(value)) {
      return; // Invalid: intentionally return no value.
    }
    const fields: Array<ConstObjectFieldNode> = [];
    const fieldDefs = type.getFields();
    const hasUndefinedField = Object.keys(value).some(
      (name) => !Object.hasOwn(fieldDefs, name),
    );
    if (hasUndefinedField) {
      return; // Invalid: intentionally return no value.
    }
    for (const field of Object.values(type.getFields())) {
      const fieldValue = value[field.name];
      if (fieldValue === undefined) {
        if (isRequiredInputField(field)) {
          return; // Invalid: intentionally return no value.
        }
      } else {
        const fieldNode = valueToLiteral(value[field.name], field.type);
        if (!fieldNode) {
          return; // Invalid: intentionally return no value.
        }
        fields.push({
          kind: Kind.OBJECT_FIELD,
          name: { kind: Kind.NAME, value: field.name },
          value: fieldNode,
        });
      }
    }
    return { kind: Kind.OBJECT, fields };
  }

  const leafType = assertLeafType(type);

  if (leafType.valueToLiteral) {
    try {
      return leafType.valueToLiteral(value);
    } catch (_error) {
      return; // Invalid: intentionally ignore error and return no value.
    }
  }

  return defaultScalarValueToLiteral(value);
}

/**
 * The default implementation to convert scalar values to literals.
 *
 * | JavaScript Value  | GraphQL Value        |
 * | ----------------- | -------------------- |
 * | Object            | Input Object         |
 * | Array             | List                 |
 * | Boolean           | Boolean              |
 * | String            | String               |
 * | Number            | Int / Float          |
 * | null / undefined  | Null                 |
 *
 * @internal
 */
export function defaultScalarValueToLiteral(value: unknown): ConstValueNode {
  // Like JSON, a null literal is produced for both null and undefined.
  if (value == null) {
    return { kind: Kind.NULL };
  }

  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
  switch (typeof value) {
    case 'boolean':
      return { kind: Kind.BOOLEAN, value };
    case 'string':
      return { kind: Kind.STRING, value, block: false };
    case 'number': {
      if (!Number.isFinite(value)) {
        // Like JSON, a null literal is produced for non-finite values.
        return { kind: Kind.NULL };
      }
      const stringValue = String(value);
      // Will parse as an IntValue.
      return /^-?(?:0|[1-9][0-9]*)$/.test(stringValue)
        ? { kind: Kind.INT, value: stringValue }
        : { kind: Kind.FLOAT, value: stringValue };
    }
    case 'object': {
      if (isIterableObject(value)) {
        return {
          kind: Kind.LIST,
          values: Array.from(value, defaultScalarValueToLiteral),
        };
      }
      const objValue = value as { [prop: string]: unknown };
      const fields: Array<ConstObjectFieldNode> = [];
      for (const fieldName of Object.keys(objValue)) {
        const fieldValue = objValue[fieldName];
        // Like JSON, undefined fields are not included in the literal result.
        if (fieldValue !== undefined) {
          fields.push({
            kind: Kind.OBJECT_FIELD,
            name: { kind: Kind.NAME, value: fieldName },
            value: defaultScalarValueToLiteral(fieldValue),
          });
        }
      }
      return { kind: Kind.OBJECT, fields };
    }
  }

  throw new TypeError(`Cannot convert value to AST: ${inspect(value)}.`);
}
