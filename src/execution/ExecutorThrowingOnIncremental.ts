import { invariant } from '../jsutils/invariant.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

import { OperationTypeNode } from '../language/ast.js';

import type {
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from '../type/index.js';

import type {
  DeferUsage,
  FieldDetailsList,
  GroupedFieldSet,
} from './collectFields.js';
import { Executor, getStreamUsage } from './Executor.js';

const UNEXPECTED_MULTIPLE_PAYLOADS =
  'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)';

/** @internal */
export class ExecutorThrowingOnIncremental extends Executor {
  override executeCollectedRootFields(
    operation: OperationTypeNode,
    rootType: GraphQLObjectType,
    rootValue: unknown,
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
      this.cancel(reason);
      throw reason;
    }
    return this.executeRootGroupedFieldSet(
      operation,
      rootType,
      rootValue,
      originalGroupedFieldSet,
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
      this.cancel(reason);
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
      this.cancel(reason);
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
