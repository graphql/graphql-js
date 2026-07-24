import { naturalCompare } from '../../../jsutils/naturalCompare.ts';

import type { ArgumentNode, ValueNode } from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';

/**
 * Returns the same key for argument lists that make the same field call.
 *
 * @internal
 */
export function argumentsKey(
  args: ReadonlyArray<ArgumentNode> | undefined,
): string {
  if (args == null || args.length === 0) {
    return '[]';
  }
  const valuesByName = new Map<string, unknown>();
  for (const { name, value } of args) {
    valuesByName.set(name.value, valueKey(value));
  }
  const sortedValues = Array.from(valuesByName);
  sortedValues.sort(([name1], [name2]) => naturalCompare(name1, name2));
  return JSON.stringify(sortedValues);
}

function valueKey(value: ValueNode): unknown {
  switch (value.kind) {
    case Kind.VARIABLE:
      return [value.kind, value.name.value];
    case Kind.LIST:
      return [value.kind, value.values.map((item) => valueKey(item))];
    case Kind.OBJECT: {
      const fields = value.fields.map(
        ({ name, value: fieldValue }) =>
          [name.value, valueKey(fieldValue)] as const,
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
