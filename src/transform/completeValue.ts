import { invariant } from '../jsutils/invariant.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import { addPath } from '../jsutils/Path.js';

import type { GraphQLError } from '../error/GraphQLError.js';

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

import type { TransformationContext } from './buildTransformationContext.js';
import type { FieldDetailsList, GroupedFieldSet } from './collectFields.js';
import { collectSubfields as _collectSubfields } from './collectFields.js';
import { memoize3of4 } from './memoize3of4.js';

const collectSubfields = memoize3of4(
  (
    context: TransformationContext,
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
    path: Path | undefined,
  ) => _collectSubfields(context, returnType, fieldDetailsList, path),
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
    if (responseName === context.prefix) {
      continue;
    }

    const fieldName = fieldDetailsList[0].node.name.value;
    const fieldDef = context.transformedArgs.schema.getField(
      rootType,
      fieldName,
    );
    invariant(fieldDef != null);

    data[responseName] = completeSubValue(
      context,
      errors,
      fieldDef.type,
      fieldDetailsList,
      rootValue[responseName],
      addPath(path, responseName, undefined),
    );
  }

  return data;
}

// eslint-disable-next-line @typescript-eslint/max-params
function completeSubValue(
  context: TransformationContext,
  errors: Array<GraphQLError>,
  returnType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  result: unknown,
  path: Path,
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
    );
  }

  invariant(isObjectLike(result));
  return completeObjectType(context, errors, fieldDetailsList, result, path);
}

function completeObjectType(
  context: TransformationContext,
  errors: Array<GraphQLError>,
  fieldDetailsList: FieldDetailsList,
  result: ObjMap<unknown>,
  path: Path,
): ObjMap<unknown> {
  const { prefix } = context;

  const typeName = result[prefix];

  invariant(typeof typeName === 'string');

  const runtimeType = context.transformedArgs.schema.getType(typeName);

  invariant(isObjectType(runtimeType));

  const completed = Object.create(null);

  const groupedFieldSet = collectSubfields(
    context,
    runtimeType,
    fieldDetailsList,
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
    invariant(fieldDef != null);

    completed[responseName] = completeSubValue(
      context,
      errors,
      fieldDef.type,
      subFieldDetailsList,
      result[responseName],
      addPath(path, responseName, undefined),
    );
  }

  return completed;
}

// eslint-disable-next-line @typescript-eslint/max-params
function completeListValue(
  context: TransformationContext,
  errors: Array<GraphQLError>,
  returnType: GraphQLOutputType,
  fieldDetailsList: FieldDetailsList,
  result: Array<unknown>,
  path: Path,
): Array<unknown> {
  const completedItems = [];
  for (let index = 0; index < result.length; index++) {
    const completed = completeSubValue(
      context,
      errors,
      returnType,
      fieldDetailsList,
      result[index],
      addPath(path, index, undefined),
    );
    completedItems.push(completed);
  }
  return completedItems;
}
