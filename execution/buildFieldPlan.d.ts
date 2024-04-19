import type { DeferUsage, GroupedFieldSet } from './collectFields.js';
export type DeferUsageSet = ReadonlySet<DeferUsage>;
export interface FieldPlan {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSets: Map<DeferUsageSet, GroupedFieldSet>;
}
export declare function buildFieldPlan(
  originalGroupedFieldSet: GroupedFieldSet,
  parentDeferUsages?: DeferUsageSet,
): FieldPlan;
