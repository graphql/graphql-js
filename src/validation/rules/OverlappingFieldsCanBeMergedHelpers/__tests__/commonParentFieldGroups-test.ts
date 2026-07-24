import { describe, it } from 'node:test';

import { expect } from 'chai';

import { Kind } from '../../../../language/kinds.ts';

import {
  GraphQLInterfaceType,
  GraphQLObjectType,
} from '../../../../type/definition.ts';
import { GraphQLSchema } from '../../../../type/schema.ts';

import { commonParentFieldGroups } from '../commonParentFieldGroups.ts';
import { FieldGroup } from '../FieldGroup.ts';
import { FieldOccurrence } from '../FieldOccurrence.ts';

const schema = new GraphQLSchema({});
const context = {
  addValidationWork: () => undefined,
  getSchema: () => schema,
};

function objectType(name: string): GraphQLObjectType {
  return new GraphQLObjectType({ name, fields: {} });
}

const abstractType = new GraphQLInterfaceType({
  name: 'Abstract',
  fields: {},
});

function field(name: string): FieldOccurrence {
  return new FieldOccurrence(context, undefined, {
    kind: Kind.FIELD,
    name: { kind: Kind.NAME, value: name },
  });
}

function fieldGroup(
  abstractFields: ReadonlyArray<FieldOccurrence>,
  fieldsByObjectType: ReadonlyArray<
    readonly [GraphQLObjectType, ReadonlyArray<FieldOccurrence>]
  >,
): FieldGroup {
  return new FieldGroup([
    ...abstractFields.map((fieldOccurrence) => {
      fieldOccurrence.parentType = abstractType;
      return fieldOccurrence;
    }),
    ...fieldsByObjectType.flatMap(([parentType, fields]) =>
      fields.map((fieldOccurrence) => {
        fieldOccurrence.parentType = parentType;
        return fieldOccurrence;
      }),
    ),
  ]);
}

function fieldNames(
  groups: Iterable<ReadonlyArray<FieldOccurrence>>,
): ReadonlyArray<ReadonlyArray<string>> {
  return Array.from(groups, (fields) =>
    fields.map((fieldOccurrence) => fieldOccurrence.node.name.value),
  );
}

describe('commonParentFieldGroups', () => {
  it('groups abstract fields with each possible concrete parent', () => {
    const cat = objectType('Cat');
    const dog = objectType('Dog');
    const groups = commonParentFieldGroups([
      fieldGroup(
        [field('abstract1')],
        [
          [cat, [field('cat1')]],
          [dog, [field('dog1')]],
        ],
      ),
      fieldGroup(
        [field('abstract2')],
        [
          [cat, [field('cat2')]],
          [dog, [field('dog2')]],
        ],
      ),
    ]);

    expect(fieldNames(groups)).to.deep.equal([
      ['abstract1', 'abstract2', 'cat1', 'cat2'],
      ['abstract1', 'abstract2', 'dog1', 'dog2'],
    ]);
  });

  it('yields one group for one concrete parent', () => {
    const cat = objectType('Cat');
    const groups = commonParentFieldGroups([
      fieldGroup([], [[cat, [field('cat')]]]),
    ]);

    expect(fieldNames(groups)).to.deep.equal([['cat']]);
  });

  it('yields one group when all parents are abstract', () => {
    const groups = commonParentFieldGroups([
      fieldGroup([field('abstract1')], []),
      fieldGroup([field('abstract2')], []),
    ]);

    expect(fieldNames(groups)).to.deep.equal([['abstract1', 'abstract2']]);
  });

  it('groups fields without parent types separately from concrete parents', () => {
    const cat = objectType('Cat');
    const groups = commonParentFieldGroups([
      new FieldGroup([field('untyped1')]),
      fieldGroup([], [[cat, [field('cat1'), field('cat2')]]]),
      new FieldGroup([field('untyped2')]),
    ]);

    expect(fieldNames(groups)).to.deep.equal([
      ['cat1', 'cat2'],
      ['untyped1', 'untyped2'],
    ]);
  });

  it('groups abstract fields with fields without parent types', () => {
    const groups = commonParentFieldGroups([
      fieldGroup([field('abstract')], []),
      new FieldGroup([field('untyped')]),
    ]);

    expect(fieldNames(groups)).to.deep.equal([['abstract', 'untyped']]);
  });
});
