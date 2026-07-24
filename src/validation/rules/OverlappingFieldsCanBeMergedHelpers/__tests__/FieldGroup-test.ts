import { describe, it } from 'node:test';

import { expect } from 'chai';

import { Kind } from '../../../../language/kinds.ts';

import type { GraphQLNamedType } from '../../../../type/definition.ts';
import {
  GraphQLInterfaceType,
  GraphQLObjectType,
} from '../../../../type/definition.ts';
import { GraphQLSchema } from '../../../../type/schema.ts';

import { FieldGroup } from '../FieldGroup.ts';
import { FieldOccurrence } from '../FieldOccurrence.ts';

const schema = new GraphQLSchema({});
const context = { getSchema: () => schema };

function field(
  name: string,
  parentType: GraphQLNamedType | undefined,
): FieldOccurrence {
  return new FieldOccurrence(context, parentType, {
    kind: Kind.FIELD,
    name: { kind: Kind.NAME, value: name },
  });
}

function groupFixture() {
  const pet = new GraphQLInterfaceType({ name: 'Pet', fields: {} });
  const cat = new GraphQLObjectType({ name: 'Cat', fields: {} });
  const dog = new GraphQLObjectType({ name: 'Dog', fields: {} });
  const abstractField = field('abstract', pet);
  const unknownField = field('unknown', undefined);
  const catField1 = field('cat1', cat);
  const catField2 = field('cat2', cat);
  const dogField = field('dog', dog);
  const fields = [abstractField, catField1, unknownField, dogField, catField2];
  return {
    group: new FieldGroup(fields),
    fields,
    abstractField,
    unknownField,
    cat,
    catField1,
    catField2,
    dog,
    dogField,
  };
}

describe('FieldGroup', () => {
  it('retains its field occurrences', () => {
    const { group, fields } = groupFixture();

    expect(group.getFields()).to.equal(fields);
  });

  it('collects fields with abstract parents', () => {
    const { group, abstractField } = groupFixture();

    expect(group.getParentTypeDetails().abstractFields).to.deep.equal([
      abstractField,
    ]);
  });

  it('does not classify fields without parent types as abstract', () => {
    const { group, unknownField } = groupFixture();

    expect(group.getParentTypeDetails().abstractFields).not.to.include(
      unknownField,
    );
    expect(group.getParentTypeDetails().untypedFields).to.deep.equal([
      unknownField,
    ]);
  });

  it('groups fields by concrete parent object', () => {
    const { group, cat, catField1, catField2, dog, dogField } = groupFixture();

    expect(
      group.getParentTypeDetails().fieldsByObjectType.get(cat),
    ).to.deep.equal([catField1, catField2]);
    expect(
      group.getParentTypeDetails().fieldsByObjectType.get(dog),
    ).to.deep.equal([dogField]);
  });

  it('caches collected field details', () => {
    const { group } = groupFixture();

    expect(group.getParentTypeDetails()).to.equal(group.getParentTypeDetails());
  });
});
