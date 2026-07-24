import { naturalCompare } from '../../../jsutils/naturalCompare.ts';

import type {
  ArgumentNode,
  FragmentArgumentNode,
  ValueNode,
} from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';

/**
 * Identifies variables by their lexical declarations so variables with the
 * same name in different scopes remain distinct.
 *
 * @internal
 */
export type VariableScope = ReadonlyMap<string, string>;

/**
 * Returns the same key for argument lists that make the same field call within
 * their lexical variable scopes.
 *
 * @internal
 */
export function argumentsKey(
  args: ReadonlyArray<ArgumentNode | FragmentArgumentNode> | undefined,
  variableScope?: VariableScope,
): string {
  if (args == null || args.length === 0) {
    return '[]';
  }
  const valuesByName = new Map<string, unknown>();
  for (const { name, value } of args) {
    valuesByName.set(name.value, valueKey(value, variableScope));
  }
  const sortedValues = Array.from(valuesByName);
  sortedValues.sort(([name1], [name2]) => naturalCompare(name1, name2));
  return JSON.stringify(sortedValues);
}

function valueKey(
  value: ValueNode,
  variableScope: VariableScope | undefined,
): unknown {
  switch (value.kind) {
    case Kind.VARIABLE:
      return [
        value.kind,
        variableScope?.get(value.name.value) ??
          JSON.stringify(['operation', value.name.value]),
      ];
    case Kind.LIST:
      return [
        value.kind,
        value.values.map((item) => valueKey(item, variableScope)),
      ];
    case Kind.OBJECT: {
      const fields = value.fields.map(
        ({ name, value: fieldValue }) =>
          [name.value, valueKey(fieldValue, variableScope)] as const,
      );
      fields.sort(([name1], [name2]) => naturalCompare(name1, name2));
      return [value.kind, fields];
    }
    case Kind.NULL:
      return [value.kind];
    default:
      return [value.kind, value.value];
  }
}
