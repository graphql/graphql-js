/** @category Values */

import { keyValMap } from '../jsutils/keyValMap';
import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';

import type { ValueNode } from '../language/ast';
import { Kind } from '../language/kinds';

/**
 * Produces a JavaScript value given a GraphQL Value AST.
 *
 * Because no GraphQL type is provided, the returned JavaScript value reflects
 * the provided GraphQL value AST.
 *
 * | GraphQL Value        | JavaScript Value |
 * | -------------------- | ---------------- |
 * | Input Object         | Object           |
 * | List                 | Array            |
 * | Boolean              | Boolean          |
 * | String / Enum        | String           |
 * | Int / Float          | Number           |
 * | Null                 | null             |
 * @param valueNode - GraphQL value AST node to convert.
 * @param variables - Optional runtime variable values keyed by variable name.
 * @returns JavaScript value represented by the GraphQL value AST.
 * @example
 * ```ts
 * import { parseValue } from 'graphql/language';
 * import { valueFromASTUntyped } from 'graphql/utilities';
 *
 * const value = valueFromASTUntyped(parseValue('[1, 2, 3]'));
 *
 * value; // => [1, 2, 3]
 * valueFromASTUntyped(parseValue('$name'), { name: 'Ada' }); // => 'Ada'
 * ```
 */
export function valueFromASTUntyped(
  valueNode: ValueNode,
  variables?: Maybe<ObjMap<unknown>>,
): unknown {
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
      return valueNode.values.map((node) =>
        valueFromASTUntyped(node, variables),
      );
    case Kind.OBJECT:
      return keyValMap(
        valueNode.fields,
        (field) => field.name.value,
        (field) => valueFromASTUntyped(field.value, variables),
      );
    case Kind.VARIABLE:
      return variables?.[valueNode.name.value];
  }
}
