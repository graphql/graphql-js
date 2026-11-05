import type { ObjMap } from '../../jsutils/ObjMap.ts';
import type { Path } from '../../jsutils/Path.ts';

import type {
  GraphQLField,
  GraphQLFieldBatchResolver,
  GraphQLObjectType,
} from '../../type/definition.ts';

import type { FieldDetailsList } from '../collectFields.ts';

import type { BatchExecutor } from './types.ts';

/** @internal */
// eslint-disable-next-line max-params
export function enqueueBatchField<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  parentType: GraphQLObjectType,
  fieldDef: GraphQLField<unknown, unknown>,
  batchResolve: GraphQLFieldBatchResolver<unknown, unknown>,
  fieldDetailsList: FieldDetailsList,
  source: unknown,
  path: Path,
  positionContext: TPositionContext | undefined,
  responseTarget: ObjMap<unknown>,
  responseKey: string,
): void {
  let batchGroup = executor.batchFieldGroups.get(fieldDetailsList);
  if (batchGroup === undefined) {
    batchGroup = {
      fieldDef,
      batchResolve,
      fieldDetailsList,
      fieldNodes: fieldDetailsList.map((fieldDetails) => fieldDetails.node),
      parentType,
      entries: [],
    };
    executor.batchFieldGroups.set(fieldDetailsList, batchGroup);
  }

  batchGroup.entries.push({
    source,
    path,
    positionContext,
    responseTarget,
    responseKey,
  });
}
