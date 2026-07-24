import { AccumulatorMap } from '../../../jsutils/AccumulatorMap.ts';

import type { GraphQLObjectType } from '../../../type/definition.ts';

import type { FieldGroup } from './FieldGroup.ts';
import type { FieldOccurrence } from './FieldOccurrence.ts';

/**
 * Yields maximal groups of field occurrences that may apply to the same
 * runtime object. Abstract fields join every compatible group. Fields with an
 * unknown parent form a separate concrete-like group because they cannot be
 * assumed to overlap fields from a known concrete type.
 *
 * @internal
 */
export function* commonParentFieldGroups(
  fieldGroups: ReadonlyArray<FieldGroup>,
): IterableIterator<ReadonlyArray<FieldOccurrence>> {
  const abstractFields: Array<FieldOccurrence> = [];
  const untypedFields: Array<FieldOccurrence> = [];
  const fieldsByObjectType = new AccumulatorMap<
    GraphQLObjectType,
    FieldOccurrence
  >();

  for (const fieldGroup of fieldGroups) {
    const {
      abstractFields: groupAbstractFields,
      untypedFields: groupUntypedFields,
      fieldsByObjectType: groupFieldsByObjectType,
    } = fieldGroup.getParentTypeDetails();
    for (const field of groupAbstractFields) {
      abstractFields.push(field);
    }
    for (const field of groupUntypedFields) {
      untypedFields.push(field);
    }
    for (const [parentType, objectFields] of groupFieldsByObjectType) {
      for (const field of objectFields) {
        fieldsByObjectType.add(parentType, field);
      }
    }
  }

  if (fieldsByObjectType.size === 0) {
    if (abstractFields.length !== 0 || untypedFields.length !== 0) {
      yield [...abstractFields, ...untypedFields];
    }
    return;
  }
  for (const objectFields of fieldsByObjectType.values()) {
    yield [...abstractFields, ...objectFields];
  }
  if (untypedFields.length !== 0) {
    yield [...abstractFields, ...untypedFields];
  }
}
