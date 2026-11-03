import { invariant } from "../jsutils/invariant.mjs";
import { OperationTypeNode } from "../language/ast.mjs";
import { Executor, getStreamUsage } from "./Executor.mjs";
const UNEXPECTED_MULTIPLE_PAYLOADS = 'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)';
export class ExecutorThrowingOnIncremental extends Executor {
    executeCollectedRootFields(rootType, rootValue, originalGroupedFieldSet, serially, newDeferUsages) {
        if (newDeferUsages.length > 0) {
            if (!(this.validatedExecutionArgs.operation.operation !==
                OperationTypeNode.SUBSCRIPTION))
                invariant(false, '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.');
            const reason = new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
            this.abort(reason);
            throw reason;
        }
        return this.executeRootGroupedFieldSet(rootType, rootValue, originalGroupedFieldSet, serially, undefined);
    }
    executeCollectedSubfields(parentType, sourceValue, path, originalGroupedFieldSet, newDeferUsages) {
        if (newDeferUsages.length > 0) {
            if (!(this.validatedExecutionArgs.operation.operation !==
                OperationTypeNode.SUBSCRIPTION))
                invariant(false, '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.');
            const reason = new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
            this.abort(reason);
            throw reason;
        }
        return this.executeFields(parentType, sourceValue, path, originalGroupedFieldSet, undefined);
    }
    completeListValue(returnType, fieldDetailsList, info, path, result, positionContext) {
        const streamUsage = getStreamUsage(this.validatedExecutionArgs, fieldDetailsList);
        if (streamUsage !== undefined) {
            if (!(this.validatedExecutionArgs.operation.operation !==
                OperationTypeNode.SUBSCRIPTION))
                invariant(false, '`@stream` directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.');
            const reason = new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
            this.abort(reason);
            throw reason;
        }
        return super.completeListValue(returnType, fieldDetailsList, info, path, result, positionContext);
    }
}
//# sourceMappingURL=ExecutorThrowingOnIncremental.mjs.map