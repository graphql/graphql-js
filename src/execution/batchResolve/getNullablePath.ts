import { invariant } from '../../jsutils/invariant.ts';
import type { Path } from '../../jsutils/Path.ts';

import type { GraphQLOutputType } from '../../type/definition.ts';
import {
  isListType,
  isNonNullType,
  isObjectType,
} from '../../type/definition.ts';

import type { FieldDetailsList, GroupedFieldSet } from '../collectFields.ts';
import { collectSubfields } from '../collectSubfields.ts';
import type { ValidatedExecutionArgs } from '../ExecutionArgs.ts';

/** @internal */
export function getNullablePath(
  validatedExecutionArgs: ValidatedExecutionArgs,
  rootGroupedFieldSet: GroupedFieldSet,
  path: Path,
): Path | undefined {
  const pathEntries: Array<Path> = [];
  for (
    let currentPath: Path | undefined = path;
    currentPath !== undefined;
    currentPath = currentPath.prev
  ) {
    pathEntries.push(currentPath);
  }
  pathEntries.reverse();

  const { schema, operation } = validatedExecutionArgs;
  let parentType = schema.getRootType(operation.operation);
  invariant(
    parentType != null,
    'Cannot determine a batch error path without a root operation type.',
  );

  let groupedFieldSet: GroupedFieldSet | undefined = rootGroupedFieldSet;
  let fieldDetailsList: FieldDetailsList | undefined;
  let outputType: GraphQLOutputType | undefined;
  let nullablePath: Path | undefined;

  for (const pathEntry of pathEntries) {
    if (typeof pathEntry.key === 'number') {
      invariant(
        outputType !== undefined,
        'Cannot evaluate a batch list item path before its parent field type is known.',
      );

      const nullableListType = isNonNullType(outputType)
        ? outputType.ofType
        : outputType;
      invariant(
        isListType(nullableListType),
        'Cannot evaluate a batch list item path for a non-list parent field type.',
      );

      outputType = nullableListType.ofType;
      if (!isNonNullType(outputType)) {
        nullablePath = pathEntry;
      }
      continue;
    }

    if (groupedFieldSet === undefined) {
      invariant(
        fieldDetailsList !== undefined,
        'Cannot collect batch subfields before parent field details are known.',
      );
      invariant(
        pathEntry.typename !== undefined,
        'Cannot collect batch subfields from a response path without a typename.',
      );

      const maybeParentType = schema.getType(pathEntry.typename);
      invariant(
        isObjectType(maybeParentType),
        `Cannot collect batch subfields for non-object type "${pathEntry.typename}".`,
      );

      parentType = maybeParentType;
      groupedFieldSet = collectSubfields(
        validatedExecutionArgs,
        parentType,
        fieldDetailsList,
      ).groupedFieldSet;
    }

    fieldDetailsList = groupedFieldSet.get(pathEntry.key);
    invariant(
      fieldDetailsList !== undefined,
      `Cannot find collected batch field details for response key "${pathEntry.key}".`,
    );

    const fieldName = fieldDetailsList[0].node.name.value;
    const fieldDef = schema.getField(parentType, fieldName);
    invariant(
      fieldDef !== undefined,
      `Cannot find field definition for batched field "${parentType.name}.${fieldName}".`,
    );

    outputType = fieldDef.type;
    if (!isNonNullType(outputType)) {
      nullablePath = pathEntry;
    }
    groupedFieldSet = undefined;
  }

  return nullablePath;
}
