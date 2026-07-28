import { AccumulatorMap } from '../../../jsutils/AccumulatorMap.ts';

import type { GraphQLObjectType } from '../../../type/definition.ts';
import { isAbstractType, isObjectType } from '../../../type/definition.ts';

import type { FieldOccurrence } from './FieldOccurrence.ts';

/**
 * All occurrences of one response name contributed by one FieldSet.
 *
 * @internal
 */
export class FieldGroup {
  private _fields: Array<FieldOccurrence>;
  private _details:
    | {
        abstractFields: ReadonlyArray<FieldOccurrence>;
        untypedFields: ReadonlyArray<FieldOccurrence>;
        fieldsByObjectType: ReadonlyMap<
          GraphQLObjectType,
          ReadonlyArray<FieldOccurrence>
        >;
      }
    | undefined;

  constructor(fields: Array<FieldOccurrence>) {
    this._fields = fields;
  }

  getFields(): ReadonlyArray<FieldOccurrence> {
    return this._fields;
  }

  getParentTypeDetails(): {
    abstractFields: ReadonlyArray<FieldOccurrence>;
    untypedFields: ReadonlyArray<FieldOccurrence>;
    fieldsByObjectType: ReadonlyMap<
      GraphQLObjectType,
      ReadonlyArray<FieldOccurrence>
    >;
  } {
    if (this._details !== undefined) {
      return this._details;
    }
    const abstractFields: Array<FieldOccurrence> = [];
    const untypedFields: Array<FieldOccurrence> = [];
    const fieldsByObjectType = new AccumulatorMap<
      GraphQLObjectType,
      FieldOccurrence
    >();
    for (const field of this._fields) {
      const parentType = field.parentType;
      if (isObjectType(parentType)) {
        fieldsByObjectType.add(parentType, field);
      } else if (isAbstractType(parentType)) {
        abstractFields.push(field);
      } else {
        untypedFields.push(field);
      }
    }
    return (this._details = {
      abstractFields,
      untypedFields,
      fieldsByObjectType,
    });
  }

  addField(field: FieldOccurrence): void {
    this._fields.push(field);
  }
}
