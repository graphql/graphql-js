import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
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

import type {
  OriginalStream,
  TransformationContext,
} from './buildTransformationContext.js';
import type { FieldDetails, GroupedFieldSet } from './collectFields.js';
import { collectSubfields as _collectSubfields } from './collectFields.js';
import { groupedFieldSetFromTree } from './groupedFieldSetFromTree.js';

const collectSubfields = memoize3(
  (
    transformationContext: TransformationContext,
    returnType: GraphQLObjectType,
    fieldDetailsList: ReadonlyArray<FieldDetails>,
  ) => _collectSubfields(transformationContext, returnType, fieldDetailsList),
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
function completeSubValue(
  context: TransformationContext,
  errors: Array<GraphQLError>,
  returnType: GraphQLOutputType,
  fieldDetailsList: ReadonlyArray<FieldDetails>,
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

    const itemType = returnType.ofType;

    const completed = completeListValue(
      context,
      errors,
      itemType,
      fieldDetailsList,
      result,
      path,
    );

    maybeAddStream(context, itemType, fieldDetailsList, path, result.length);

    return completed;
  }

  invariant(isObjectLike(result));
  return completeObjectValue(context, errors, fieldDetailsList, result, path);
}

function completeObjectValue(
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

    const {
      groupedFieldSet: groupedFieldSetWithoutInlinedDefers,
      deferredFragmentTree,
    } = collectSubfields(context, runtimeType, fieldDetailsList);

    const groupedFieldSet = groupedFieldSetFromTree(
      context,
      groupedFieldSetWithoutInlinedDefers,
      deferredFragmentTree,
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
export function completeListValue(
  context: TransformationContext,
  errors: Array<GraphQLError>,
  itemType: GraphQLOutputType,
  fieldDetailsList: ReadonlyArray<FieldDetails>,
  result: Array<unknown>,
  path: Path,
  initialIndex = 0,
): Array<unknown> {
  const completedItems = [];

  for (let index = initialIndex; index < result.length; index++) {
    const completed = completeSubValue(
      context,
      errors,
      itemType,
      fieldDetailsList,
      result[index],
      addPath(path, index, undefined),
    );
    completedItems.push(completed);
  }

  return completedItems;
}

function maybeAddStream(
  context: TransformationContext,
  itemType: GraphQLOutputType,
  fieldDetailsList: ReadonlyArray<FieldDetails>,
  path: Path,
  nextIndex: number,
): void {
  const pendingLabels = context.pendingLabelsByPath.get(
    pathToArray(path).join('.'),
  );
  if (pendingLabels == null) {
    return;
  }
  const pendingLabel = pendingLabels.values().next().value;
  invariant(pendingLabel != null);

  const streamLabelByDeferLabel = new Map<
    string | undefined,
    string | undefined
  >();
  const fieldDetailsListByDeferLabel = new AccumulatorMap<
    string | undefined,
    FieldDetails
  >();
  for (const fieldDetails of fieldDetailsList) {
    const directives = fieldDetails.node.directives;
    if (directives) {
      const stream = directives.find(
        (directive) => directive.name.value === GraphQLStreamDirective.name,
      );
      if (stream != null) {
        const labelArg = stream.arguments?.find(
          (arg) => arg.name.value === 'label',
        );
        invariant(labelArg != null);
        const labelValue = labelArg.value;
        invariant(labelValue.kind === Kind.STRING);
        const label = labelValue.value;
        const originalLabel = context.originalStreamLabels.get(label);
        const deferLabel = fieldDetails.deferLabel;
        streamLabelByDeferLabel.set(deferLabel, originalLabel);
        fieldDetailsListByDeferLabel.add(deferLabel, fieldDetails);
      }
    }
  }

  if (fieldDetailsListByDeferLabel.size > 0) {
    const originalStreams: Array<OriginalStream> = [];
    for (const [
      deferLabel,
      fieldDetailsListForDeferLabel,
    ] of fieldDetailsListByDeferLabel) {
      const originalLabel = streamLabelByDeferLabel.get(deferLabel);
      originalStreams.push({
        originalLabel,
        fieldDetailsList: fieldDetailsListForDeferLabel,
      });
    }
    const streamsForPendingLabel = context.streams.get(pendingLabel);
    if (streamsForPendingLabel == null) {
      context.streams.set(pendingLabel, {
        path,
        itemType,
        originalStreams,
        nextIndex,
      });
    } else {
      streamsForPendingLabel.originalStreams.push(...originalStreams);
    }
  }
}
