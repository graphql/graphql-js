import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { GraphQLError } from '../../../../error/GraphQLError.ts';

import { Kind } from '../../../../language/kinds.ts';
import { parse } from '../../../../language/parser.ts';

import { isCompositeType } from '../../../../type/definition.ts';

import { buildSchema } from '../../../../utilities/buildASTSchema.ts';
import { TypeInfo } from '../../../../utilities/TypeInfo.ts';

import { ValidationContext } from '../../../ValidationContext.ts';

import { FieldSet } from '../FieldSet.ts';

const schema = buildSchema(`
  interface Pet {
    name: String
    child: Pet
  }

  type Cat implements Pet {
    name: String
    child: Pet
  }

  type Query {
    pet: Pet
  }
`);

function fieldSetFixture(
  onCollect?: () => void,
  selections = `
    name
    ... on Cat { name child { name } }
    ...Defined
    ...Unknown
  `,
): FieldSet {
  const document = parse(`
    fragment F on Pet {
      ${selections}
    }
    fragment Defined on Pet { name }
  `);
  const context = new ValidationContext(
    schema,
    document,
    new TypeInfo(schema),
    (error: GraphQLError) => {
      throw error;
    },
  );
  const definition = document.definitions[0];
  const parentType = schema.getType('Pet');
  if (
    definition?.kind !== Kind.FRAGMENT_DEFINITION ||
    !isCompositeType(parentType)
  ) {
    throw new Error('Expected a fragment on Pet.');
  }
  return new FieldSet(
    {
      validationContext: {
        addValidationWork: (work) => context.addValidationWork(work),
        getFragment: (fragmentName) => context.getFragment(fragmentName),
        getSchema: () => {
          onCollect?.();
          return context.getSchema();
        },
      },
      usesFragmentArguments: false,
      getFragmentSignature: context.getFragmentSignatureByName(),
    },
    definition.selectionSet,
    parentType,
  );
}

describe('FieldSet', () => {
  it('defers field collection', () => {
    let collectionCount = 0;
    const fieldSet = fieldSetFixture(() => {
      collectionCount++;
    });

    expect(collectionCount).to.equal(0);

    fieldSet.getFieldGroupsByResponseName();

    expect(collectionCount).to.equal(1);
  });

  it('collects direct fields together with inline fragments', () => {
    const fieldSet = fieldSetFixture();

    const fieldGroups = fieldSet.getFieldGroupsByResponseName();

    expect(fieldGroups.get('name')?.getFields()).to.have.length(2);
    expect(fieldGroups.get('child')?.getFields()).to.have.length(1);
  });

  it('collects only defined fragment spreads', () => {
    const fieldSet = fieldSetFixture();
    const fragmentSpreads = fieldSet.getFragmentSpreadsByName();

    expect(fragmentSpreads.has('Defined')).to.equal(true);
    expect(fragmentSpreads.has('Unknown')).to.equal(false);
  });

  it('indexes fields by response name', () => {
    const fieldSet = fieldSetFixture();

    expect(
      fieldSet.getFieldGroupsByResponseName().get('name')?.getFields(),
    ).to.have.length(2);
  });

  it('recognizes overlapping fields', () => {
    expect(fieldSetFixture().hasOverlappingFields()).to.equal(true);
  });

  it('recognizes fields with distinct response names', () => {
    expect(
      fieldSetFixture(undefined, 'name child { name }').hasOverlappingFields(),
    ).to.equal(false);
  });

  it('caches field groups', () => {
    const fieldSet = fieldSetFixture();

    const fieldGroups = fieldSet.getFieldGroupsByResponseName();

    expect(fieldSet.getFieldGroupsByResponseName()).to.equal(fieldGroups);
  });

  it('shares collection between field and fragment queries', () => {
    let collectionCount = 0;
    const fieldSet = fieldSetFixture(() => {
      collectionCount++;
    });

    fieldSet.getFieldGroupsByResponseName();
    fieldSet.getFragmentSpreadsByName();

    expect(collectionCount).to.equal(1);
  });
});
