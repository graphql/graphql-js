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

interface ArgumentsKeyContext {
  addValidationWork: (work: number) => void;
}

interface PendingArgumentWork {
  context: ArgumentsKeyContext;
  work: number;
}

const ARGUMENT_NODE_WORK = 2_000;
const VALUE_NODE_WORK = 2_000;
const WORK_BATCH = 100_000;

/**
 * Returns the same key for argument lists that make the same field call within
 * their lexical variable scopes.
 *
 * @internal
 */
export function argumentsKey(
  args: ReadonlyArray<ArgumentNode | FragmentArgumentNode> | undefined,
  variableScope?: VariableScope,
  context?: ArgumentsKeyContext,
): string {
  if (args == null || args.length === 0) {
    return '[]';
  }
  const pendingWork = context === undefined ? undefined : { context, work: 0 };
  addArgumentWork(pendingWork, ARGUMENT_NODE_WORK * args.length);
  const valuesByName = new Map<string, unknown>();
  for (const { name, value } of args) {
    valuesByName.set(name.value, valueKey(value, variableScope, pendingWork));
  }
  const sortedValues = Array.from(valuesByName);
  sortedValues.sort(([name1], [name2]) => naturalCompare(name1, name2));
  if (pendingWork !== undefined && pendingWork.work !== 0) {
    pendingWork.context.addValidationWork(pendingWork.work);
  }
  return JSON.stringify(sortedValues);
}

function valueKey(
  value: ValueNode,
  variableScope: VariableScope | undefined,
  pendingWork: PendingArgumentWork | undefined,
): unknown {
  addArgumentWork(pendingWork, VALUE_NODE_WORK);
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
        value.values.map((item) => valueKey(item, variableScope, pendingWork)),
      ];
    case Kind.OBJECT: {
      const fields = value.fields.map(
        ({ name, value: fieldValue }) =>
          [
            name.value,
            valueKey(fieldValue, variableScope, pendingWork),
          ] as const,
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

function addArgumentWork(
  pendingWork: PendingArgumentWork | undefined,
  work: number,
): void {
  if (pendingWork !== undefined) {
    pendingWork.work += work;
    if (pendingWork.work >= WORK_BATCH) {
      pendingWork.context.addValidationWork(pendingWork.work);
      pendingWork.work = 0;
    }
  }
}
