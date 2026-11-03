import { AccumulatorMap } from "../../jsutils/AccumulatorMap.mjs";
import { invariant } from "../../jsutils/invariant.mjs";
import { isSameSet } from "../../jsutils/isSameSet.mjs";
import { memoize1 } from "../../jsutils/memoize1.mjs";
import { memoize2 } from "../../jsutils/memoize2.mjs";
import { SetMap } from "../../jsutils/SetMap.mjs";
import { IncrementalExecutor } from "../incremental/IncrementalExecutor.mjs";
import { BranchingIncrementalPublisher } from "./BranchingIncrementalPublisher.mjs";
const buildBranchingExecutionPlanFromInitial = memoize1((groupedFieldSet) => buildBranchingExecutionPlan(groupedFieldSet));
const buildBranchingExecutionPlanFromDeferred = memoize2((groupedFieldSet, deferUsageSet) => buildBranchingExecutionPlan(groupedFieldSet, deferUsageSet));
export class BranchingIncrementalExecutor extends IncrementalExecutor {
    getCreateSubExecutor() {
        const validatedExecutionArgs = this.validatedExecutionArgs;
        const sharedExecutionContext = this.sharedExecutionContext;
        return (deferUsageSet) => new BranchingIncrementalExecutor(validatedExecutionArgs, sharedExecutionContext, deferUsageSet);
    }
    buildResponse(data) {
        const work = this.getIncrementalWork();
        const { tasks, streams } = work;
        if (tasks?.length === 0 && streams?.length === 0) {
            return super.buildResponse(data);
        }
        const errors = this.collectedErrors.errors;
        if (!(data !== null))
            invariant(false);
        const incrementalPublisher = new BranchingIncrementalPublisher();
        return incrementalPublisher.buildResponse(data, errors, work, this.validatedExecutionArgs.externalAbortSignal, this.getFinishSharedExecution());
    }
    buildRootExecutionPlan(originalGroupedFieldSet) {
        return buildBranchingExecutionPlanFromInitial(originalGroupedFieldSet);
    }
    buildSubExecutionPlan(originalGroupedFieldSet) {
        return this.deferUsageSet === undefined
            ? buildBranchingExecutionPlanFromInitial(originalGroupedFieldSet)
            : buildBranchingExecutionPlanFromDeferred(originalGroupedFieldSet, this.deferUsageSet);
    }
}
function buildBranchingExecutionPlan(originalGroupedFieldSet, parentDeferUsages = new Set()) {
    const groupedFieldSet = new AccumulatorMap();
    const newGroupedFieldSets = new SetMap();
    for (const [responseKey, fieldGroup] of originalGroupedFieldSet) {
        for (const fieldDetails of fieldGroup) {
            const deferUsage = fieldDetails.deferUsage;
            const deferUsageSet = deferUsage === undefined
                ? new Set()
                : new Set([deferUsage]);
            if (isSameSet(parentDeferUsages, deferUsageSet)) {
                groupedFieldSet.add(responseKey, fieldDetails);
            }
            else {
                const newGroupedFieldSet = newGroupedFieldSets.getOrInsertComputed(deferUsageSet, () => new AccumulatorMap());
                newGroupedFieldSet.add(responseKey, fieldDetails);
            }
        }
    }
    return {
        groupedFieldSet,
        newGroupedFieldSets,
    };
}
//# sourceMappingURL=BranchingIncrementalExecutor.mjs.map