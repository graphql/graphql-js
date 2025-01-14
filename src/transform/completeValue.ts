import { invariant } from '../jsutils/invariant.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import { memoize3 } from '../jsutils/memoize3.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import { addPath, pathToArray } from '../jsutils/Path.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import { Kind } from '../language/kinds.js';

import type {
  GraphQLObjectType,
  GraphQLOutputType,
} from '../type/definition.js';
import {
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../type/definition.js';
import { GraphQLStreamDirective } from '../type/directives.js';

import type { GroupedFieldSet } from '../execution/collectFields.js';
import type { ValidatedExecutionArgs } from '../execution/execute.js';

import type { TransformationContext } from './buildTransformationContext.js';
import type { FieldDetails } from './collectFields.js';
import { collectSubfields as _collectSubfields } from './collectFields.js';
import { groupedFieldSetFromTree } from './groupedFieldSetFromTree.js';

const collectSubfields = memoize3(
  (
    validatedExecutionArgs: ValidatedExecutionArgs,
    returnType: GraphQLObjectType,
    fieldDetailsList: ReadonlyArray<FieldDetails>,
  ) => _collectSubfields(validatedExecutionArgs, returnType, fieldDetailsList),
);

// eslint-disable-next-line @typescript-eslint/max-params
export function completeValue(
  context: TransformationContext,
  rootValue: ObjMap<unknown>,
  rootType: GraphQLObjectType,
  groupedFieldSet: GroupedFieldSet,
  errors: Array<GraphQLError>,
  path: Path | undefined,
): ObjMap<unknown> {
  const data = Object.create(null);
  for (const [responseName, fieldDetailsList] of groupedFieldSet) {
    const fieldName = fieldDetailsList[0].node.name.value;
    const fieldDef = context.transformedArgs.schema.getField(
      rootType,
      fieldName,
    );

    if (fieldDef) {
      data[responseName] = completeSubValue(
        context,
        errors,
        fieldDef.type,
        fieldDetailsList,
        rootValue[responseName],
        addPath(path, responseName, undefined),
      );
    }
  }

  return data;
}

// eslint-disable-next-line @typescript-eslint/max-params
export function completeSubValue(
  context: TransformationContext,
  errors: Array<GraphQLError>,
  returnType: GraphQLOutputType,
  fieldDetailsList: ReadonlyArray<FieldDetails>,
  result: unknown,
  path: Path,
  listDepth = 0,
): unknown {
  if (isNonNullType(returnType)) {
    return completeSubValue(
      context,
      errors,
      returnType.ofType,
      fieldDetailsList,
      result,
      path,
    );
  }

  if (result == null) {
    return null;
  }

  if (result instanceof AggregateError) {
    for (const error of result.errors) {
      errors.push(error as GraphQLError);
    }
    return null;
  }

  if (isLeafType(returnType)) {
    return result;
  }

  if (isListType(returnType)) {
    invariant(Array.isArray(result));
    return completeListValue(
      context,
      errors,
      returnType.ofType,
      fieldDetailsList,
      result,
      path,
      listDepth,
    );
  }

  invariant(isObjectLike(result));
  return completeObjectType(context, errors, fieldDetailsList, result, path);
}

function completeObjectType(
  context: TransformationContext,
  errors: Array<GraphQLError>,
  fieldDetailsList: ReadonlyArray<FieldDetails>,
  result: ObjMap<unknown>,
  path: Path,
): ObjMap<unknown> {
  const { prefix } = context;

  const typeName = result[prefix];

  const completed = Object.create(null);

  if (typeName != null) {
    invariant(typeof typeName === 'string');

    const runtimeType = context.transformedArgs.schema.getType(typeName);

    invariant(isObjectType(runtimeType));

    const groupedFieldSetTree = collectSubfields(
      context.transformedArgs,
      runtimeType,
      fieldDetailsList,
    );

    const groupedFieldSet = groupedFieldSetFromTree(
      context,
      groupedFieldSetTree,
      path,
    );

    for (const [responseName, subFieldDetailsList] of groupedFieldSet) {
      if (responseName === context.prefix) {
        continue;
      }

      const fieldName = subFieldDetailsList[0].node.name.value;
      const fieldDef = context.transformedArgs.schema.getField(
        runtimeType,
        fieldName,
      );

      if (fieldDef) {
        completed[responseName] = completeSubValue(
          context,
          errors,
          fieldDef.type,
          subFieldDetailsList,
          result[responseName],
          addPath(path, responseName, undefined),
        );
      }
    }
  }

  return completed;
}

// eslint-disable-next-line @typescript-eslint/max-params
function completeListValue(
  context: TransformationContext,
  errors: Array<GraphQLError>,
  itemType: GraphQLOutputType,
  fieldDetailsList: ReadonlyArray<FieldDetails>,
  result: Array<unknown>,
  path: Path,
  listDepth: number,
): Array<unknown> {
  const completedItems = [];

  for (let index = 0; index < result.length; index++) {
    const completed = completeSubValue(
      context,
      errors,
      itemType,
      fieldDetailsList,
      result[index],
      addPath(path, index, undefined),
      listDepth + 1,
    );
    completedItems.push(completed);
  }

  maybeAddStream(
    context,
    itemType,
    fieldDetailsList,
    listDepth,
    path,
    result.length,
  );

  return completedItems;
}

// eslint-disable-next-line @typescript-eslint/max-params
function maybeAddStream(
  context: TransformationContext,
  itemType: GraphQLOutputType,
  fieldDetailsList: ReadonlyArray<FieldDetails>,
  listDepth: number,
  path: Path,
  nextIndex: number,
): void {
  if (listDepth > 0) {
    return;
  }

  let stream;
  for (const fieldDetails of fieldDetailsList) {
    const directives = fieldDetails.node.directives;
    if (!directives) {
      continue;
    }
    stream = directives.find(
      (directive) => directive.name.value === GraphQLStreamDirective.name,
    );
    if (stream != null) {
      break;
    }
  }

  if (stream == null) {
    return;
  }

  const labelArg = stream.arguments?.find((arg) => arg.name.value === 'label');
  invariant(labelArg != null);
  const labelValue = labelArg.value;
  invariant(labelValue.kind === Kind.STRING);
  const label = labelValue.value;
  invariant(label != null);
  const pendingLabels = context.pendingLabelsByPath.get(
    pathToArray(path).join('.'),
  );
  if (pendingLabels?.has(label)) {
    const streamUsage = context.streamUsageMap.get(label);
    invariant(streamUsage != null);
    streamUsage.nextIndex = nextIndex;
    streamUsage.streams.add({
      path,
      itemType,
      fieldDetailsList,
    });
  }
}
