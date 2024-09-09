import type { DeferUsage, GroupedFieldSet } from './collectFields.js';
export type DeferUsageSet = ReadonlySet<DeferUsage>;
export interface ExecutionPlan {
    groupedFieldSet: GroupedFieldSet;
    newGroupedFieldSets: Map<DeferUsageSet, GroupedFieldSet>;
}
export declare function buildExecutionPlan(originalGroupedFieldSet: GroupedFieldSet, parentDeferUsages?: DeferUsageSet): ExecutionPlan;
