import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { GraphQLError } from '../../../../error/GraphQLError.ts';

import { parse } from '../../../../language/parser.ts';
import { visit } from '../../../../language/visitor.ts';

import { buildSchema } from '../../../../utilities/buildASTSchema.ts';
import { TypeInfo, visitWithTypeInfo } from '../../../../utilities/TypeInfo.ts';

import { ValidationContext } from '../../../ValidationContext.ts';

import type { FieldSet } from '../FieldSet.ts';
import { FieldSetGraph } from '../FieldSetGraph.ts';

const schema = buildSchema(`
  interface Pet {
    name: String
    value(arg: Int): String
  }

  type Cat implements Pet {
    name: String
    value(arg: Int): String
  }

  type Query {
    pet: Pet
  }
`);

function graphFor(source: string): {
  graph: FieldSetGraph;
  petFieldSet: FieldSet;
} {
  const document = parse(source);
  const typeInfo = new TypeInfo(schema);
  const context = new ValidationContext(
    schema,
    document,
    typeInfo,
    (error: GraphQLError) => {
      throw error;
    },
  );
  const graph = new FieldSetGraph(context);
  const fieldSets: Array<FieldSet> = [];
  visit(
    document,
    visitWithTypeInfo(
      typeInfo,
      graph.getVisitor((fieldSet) => {
        fieldSets.push(fieldSet);
      }),
    ),
  );
  const petFieldSet = fieldSets.find(
    ({ parentType }) => parentType?.name === 'Pet',
  );
  if (petFieldSet === undefined) {
    throw new Error('Expected a Pet field set.');
  }
  return { graph, petFieldSet };
}

describe('EffectiveFieldSet', () => {
  const source = `
    { pet { same: name ...F } }
    fragment F on Pet { same: value(arg: 1) ...G }
    fragment G on Pet { same: name ...F }
  `;

  it('expands each reachable fragment once', () => {
    const { graph, petFieldSet } = graphFor(source);
    const effective = graph.getEffectiveFieldSet(new Set([petFieldSet]));

    expect(effective.getFieldSets().size).to.equal(3);
  });

  it('retains starting field sets without fields', () => {
    const { graph, petFieldSet } = graphFor(`
      { pet { ...F } }
      fragment F on Pet { name }
    `);

    const effective = graph.getEffectiveFieldSet(new Set([petFieldSet]));

    expect(effective.startingFieldSets).to.deep.equal(new Set([petFieldSet]));
    expect(effective.getFieldSets().has(petFieldSet)).to.equal(true);
    expect(effective.getFieldSets().size).to.equal(2);
  });

  it('identifies field sets that contribute fields', () => {
    const { graph, petFieldSet } = graphFor(`
      { pet { ...F } }
      fragment F on Pet { name }
    `);

    const effective = graph.getEffectiveFieldSet(new Set([petFieldSet]));

    expect(effective.getFieldSetsWithFields().has(petFieldSet)).to.equal(false);
    expect(effective.getFieldSetsWithFields().size).to.equal(1);
  });

  it('caches field sets that contribute fields', () => {
    const { graph, petFieldSet } = graphFor(source);
    const effective = graph.getEffectiveFieldSet(new Set([petFieldSet]));

    const fieldSetsWithFields = effective.getFieldSetsWithFields();

    expect(effective.getFieldSetsWithFields()).to.equal(fieldSetsWithFields);
  });

  it('caches expanded field sets', () => {
    const { graph, petFieldSet } = graphFor(source);
    const effective = graph.getEffectiveFieldSet(new Set([petFieldSet]));

    const fieldSets = effective.getFieldSets();

    expect(effective.getFieldSets()).to.equal(fieldSets);
  });

  it('collects overlapping groups from every expanded field set', () => {
    const { graph, petFieldSet } = graphFor(source);
    const effective = graph.getEffectiveFieldSet(new Set([petFieldSet]));

    expect(
      effective.getOverlappingFieldGroupsByResponseName().get('same'),
    ).to.have.length(3);
  });

  it('caches overlapping field groups', () => {
    const { graph, petFieldSet } = graphFor(source);
    const effective = graph.getEffectiveFieldSet(new Set([petFieldSet]));

    const overlappingFieldGroups =
      effective.getOverlappingFieldGroupsByResponseName();

    expect(effective.getOverlappingFieldGroupsByResponseName()).to.equal(
      overlappingFieldGroups,
    );
  });
});
