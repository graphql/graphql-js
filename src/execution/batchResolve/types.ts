import type { ObjMap } from '../../jsutils/ObjMap.ts';
import type { Path } from '../../jsutils/Path.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import type { GraphQLError } from '../../error/GraphQLError.ts';

import type { FieldNode } from '../../language/ast.ts';

import type {
  GraphQLField,
  GraphQLFieldBatchResolver,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLResolveInfoHelpers,
} from '../../type/definition.ts';

import type { FieldDetailsList, GroupedFieldSet } from '../collectFields.ts';
import type { ValidatedExecutionArgs } from '../ExecutionArgs.ts';

/** @internal */
export interface CollectedErrorsLike {
  errors: ReadonlyArray<GraphQLError>;
  add: (error: GraphQLError, path: Path | undefined) => void;
  hasNulledPosition: (startPath: Path | undefined) => boolean;
  hasNulledAncestor: (startPath: Path | undefined) => boolean;
}

/** @internal */
export interface BatchExecutor<TPositionContext> {
  validatedExecutionArgs: ValidatedExecutionArgs;
  collectedErrors: CollectedErrorsLike;
  batchFieldGroups: BatchFieldGroupMap<TPositionContext>;
  rootGroupedFieldSet: GroupedFieldSet | undefined;
  getAbortSignal: () => AbortSignal | undefined;
  getAsyncHelpers: () => GraphQLResolveInfoHelpers;
  promiseAll: <T>(
    values: ReadonlyArray<PromiseOrValue<T>>,
  ) => Promise<Array<T>>;
  // eslint-disable-next-line max-params
  completeValue: (
    returnType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    positionContext: TPositionContext | undefined,
  ) => PromiseOrValue<unknown>;
  collectAndExecuteSubfields: (
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
    path: Path,
    result: unknown,
    positionContext: TPositionContext | undefined,
  ) => PromiseOrValue<ObjMap<unknown>>;
  handleFieldError: (
    rawError: unknown,
    returnType: GraphQLOutputType,
    fieldDetailsList: FieldDetailsList,
    path: Path,
  ) => void;
}

/** @internal */
export interface BatchFieldGroup<TPositionContext> {
  fieldDef: GraphQLField<unknown, unknown>;
  batchResolve: GraphQLFieldBatchResolver<unknown, unknown>;
  fieldDetailsList: FieldDetailsList;
  fieldNodes: ReadonlyArray<FieldNode>;
  parentType: GraphQLObjectType;
  entries: Array<BatchFieldEntry<TPositionContext>>;
}

/** @internal */
export interface BatchFieldEntry<TPositionContext> {
  source: unknown;
  path: Path;
  positionContext: TPositionContext | undefined;
  responseTarget: ObjMap<unknown>;
  responseKey: string;
}

/** @internal */
export type BatchFieldGroupMap<TPositionContext> = Map<
  FieldDetailsList,
  BatchFieldGroup<TPositionContext>
>;
