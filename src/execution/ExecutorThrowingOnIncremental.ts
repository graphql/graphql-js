import { invariant } from '../jsutils/invariant.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { Path } from '../jsutils/Path.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';

import { OperationTypeNode } from '../language/ast.ts';

import type {
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from '../type/index.ts';

import type {
  DeferUsage,
  FieldDetailsList,
  GroupedFieldSet,
} from './collectFields.ts';
import { Executor, getStreamUsage } from './Executor.ts';

const UNEXPECTED_MULTIPLE_PAYLOADS =
  'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)';

/** @internal */
export class ExecutorThrowingOnIncremental extends Executor {
  override executeCollectedRootFields(
    rootType: GraphQLObjectType,
    rootValue: unknown,
    originalGroupedFieldSet: GroupedFieldSet,
    serially: boolean,
    newDeferUsages: ReadonlyArray<DeferUsage>,
  ): PromiseOrValue<ObjMap<unknown>> {
    if (newDeferUsages.length > 0) {
      invariant(
        this.validatedExecutionArgs.operation.operation !==
          OperationTypeNode.SUBSCRIPTION,
        '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      );
      const reason = new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
      this.abort(reason);
      throw reason;
    }
    return this.executeRootGroupedFieldSet(
      rootType,
      rootValue,
      originalGroupedFieldSet,
      serially,
      undefined,
    );
  }

  override executeCollectedSubfields(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    originalGroupedFieldSet: GroupedFieldSet,
    newDeferUsages: ReadonlyArray<DeferUsage>,
  ): PromiseOrValue<ObjMap<unknown>> {
    if (newDeferUsages.length > 0) {
      invariant(
        this.validatedExecutionArgs.operation.operation !==
          OperationTypeNode.SUBSCRIPTION,
        '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      );
      const reason = new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
      this.abort(reason);
      throw reason;
    }

    return this.executeFields(
      parentType,
      sourceValue,
      path,
      originalGroupedFieldSet,
      undefined,
    );
  }

  // eslint-disable-next-line max-params
  override completeListValue(
    returnType: GraphQLList<GraphQLOutputType>,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    positionContext: undefined,
  ): PromiseOrValue<ReadonlyArray<unknown>> {
    const streamUsage = getStreamUsage(
      this.validatedExecutionArgs,
      fieldDetailsList,
    );
    if (streamUsage !== undefined) {
      invariant(
        this.validatedExecutionArgs.operation.operation !==
          OperationTypeNode.SUBSCRIPTION,
        '`@stream` directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
      );

      const reason = new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
      this.abort(reason);
      throw reason;
    }

    return super.completeListValue(
      returnType,
      fieldDetailsList,
      info,
      path,
      result,
      positionContext,
    );
  }
}
