import { AccumulatorMap } from '../../../jsutils/AccumulatorMap.ts';

import type { FieldGroup } from './FieldGroup.ts';
import type { FieldSet, FragmentSpreadOccurrence } from './FieldSet.ts';

/**
 * The FieldSets that contribute to one response level, including every named
 * fragment reachable from the FieldSets where the check starts.
 *
 * @internal
 */
export class EffectiveFieldSet {
  startingFieldSets: ReadonlySet<FieldSet>;
  private _getFragmentFieldSet: (
    fragmentSpread: FragmentSpreadOccurrence,
  ) => FieldSet;
  private _fieldSets: ReadonlySet<FieldSet> | undefined;
  private _fieldSetsWithFields: ReadonlySet<FieldSet> | undefined;
  private _overlappingFieldGroupsByResponseName:
    | ReadonlyMap<string, ReadonlyArray<FieldGroup>>
    | undefined;

  constructor(
    startingFieldSets: ReadonlySet<FieldSet>,
    getFragmentFieldSet: (fragmentSpread: FragmentSpreadOccurrence) => FieldSet,
  ) {
    this.startingFieldSets = startingFieldSets;
    this._getFragmentFieldSet = getFragmentFieldSet;
  }

  getFieldSets(): ReadonlySet<FieldSet> {
    if (this._fieldSets !== undefined) {
      return this._fieldSets;
    }
    const expanded = new Set(this.startingFieldSets);
    const expandedFragmentNames = new Set<string>();
    // Set iteration visits appended bodies; names terminate cycles and make
    // each fragment body appear only once in an effective field set.
    for (const fieldSet of expanded) {
      for (const [
        fragmentName,
        spreads,
      ] of fieldSet.getFragmentSpreadsByName()) {
        if (
          !this.startingFieldSets.has(fieldSet) &&
          expandedFragmentNames.has(fragmentName)
        ) {
          continue;
        }
        expandedFragmentNames.add(fragmentName);
        expanded.add(this._getFragmentFieldSet(spreads[0]));
      }
    }
    return (this._fieldSets = expanded);
  }

  getFieldSetsWithFields(): ReadonlySet<FieldSet> {
    if (this._fieldSetsWithFields !== undefined) {
      return this._fieldSetsWithFields;
    }
    const fieldSetsWithFields = new Set<FieldSet>();
    for (const fieldSet of this.getFieldSets()) {
      if (fieldSet.getFieldGroupsByResponseName().size !== 0) {
        fieldSetsWithFields.add(fieldSet);
      }
    }
    return (this._fieldSetsWithFields = fieldSetsWithFields);
  }

  getOverlappingFieldGroupsByResponseName(): ReadonlyMap<
    string,
    ReadonlyArray<FieldGroup>
  > {
    if (this._overlappingFieldGroupsByResponseName !== undefined) {
      return this._overlappingFieldGroupsByResponseName;
    }
    const fieldGroupsByResponseName = new AccumulatorMap<string, FieldGroup>();
    for (const fieldSet of this.getFieldSets()) {
      for (const [
        responseName,
        fieldGroup,
      ] of fieldSet.getFieldGroupsByResponseName()) {
        fieldGroupsByResponseName.add(responseName, fieldGroup);
      }
    }
    for (const [responseName, fieldGroups] of fieldGroupsByResponseName) {
      if (
        fieldGroups.length === 1 &&
        fieldGroups[0]?.getFields().length === 1
      ) {
        fieldGroupsByResponseName.delete(responseName);
      }
    }
    this._overlappingFieldGroupsByResponseName = fieldGroupsByResponseName;
    return fieldGroupsByResponseName;
  }
}
