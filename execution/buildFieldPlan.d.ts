import type { DeferUsage, FieldDetails } from './collectFields.js';
export type DeferUsageSet = ReadonlySet<DeferUsage>;
export interface FieldGroup {
  fields: ReadonlyArray<FieldDetails>;
  deferUsages?: DeferUsageSet | undefined;
  knownDeferUsages?: DeferUsageSet | undefined;
}
export type GroupedFieldSet = Map<string, FieldGroup>;
export interface NewGroupedFieldSetDetails {
  groupedFieldSet: GroupedFieldSet;
  shouldInitiateDefer: boolean;
}
export declare function buildFieldPlan(
  fields: Map<string, ReadonlyArray<FieldDetails>>,
  parentDeferUsages?: DeferUsageSet,
  knownDeferUsages?: DeferUsageSet,
): {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSetDetailsMap: Map<DeferUsageSet, NewGroupedFieldSetDetails>;
  newDeferUsages: ReadonlyArray<DeferUsage>;
};
