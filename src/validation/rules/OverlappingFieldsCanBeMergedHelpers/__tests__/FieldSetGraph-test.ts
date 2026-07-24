import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { GraphQLError } from '../../../../error/GraphQLError.ts';

import type { DocumentNode } from '../../../../language/ast.ts';
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
    child: Pet
    value(arg: Int): String
  }

  type Cat implements Pet {
    name: String
    child: Pet
    value(arg: Int): String
  }

  type Query {
    pet: Pet
  }
`);

function graphFor(source: string): {
  graph: FieldSetGraph;
  document: DocumentNode;
  fieldSetsToCheck: Array<FieldSet>;
  petFieldSet: FieldSet;
} {
  const document = parse(source, { experimentalFragmentArguments: true });
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
  const fieldSetsToCheck: Array<FieldSet> = [];
  visit(
    document,
    visitWithTypeInfo(
      typeInfo,
      graph.getVisitor((fieldSet) => {
        fieldSetsToCheck.push(fieldSet);
      }),
    ),
  );
  const petFieldSet = fieldSetsToCheck.find(
    ({ parentType }) => parentType?.name === 'Pet',
  );
  if (petFieldSet === undefined) {
    throw new Error('Expected built pet field set.');
  }
  return {
    graph,
    document,
    fieldSetsToCheck,
    petFieldSet,
  };
}

function fragmentFieldSetBeforeDefinition(
  source: string,
  fragmentName: string,
  responseName: string,
): FieldSet | undefined {
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
  let fragmentFieldSet: FieldSet | undefined;
  visit(
    document,
    visitWithTypeInfo(
      typeInfo,
      graph.getVisitor((fieldSet) => {
        if (fieldSet.getFragmentSpreadsByName().has(fragmentName)) {
          fragmentFieldSet = Array.from(
            graph.getEffectiveFieldSet(new Set([fieldSet])).getFieldSets(),
          ).find((expanded) =>
            expanded.getFieldGroupsByResponseName().has(responseName),
          );
        }
      }),
    ),
  );
  return fragmentFieldSet;
}

describe('FieldSetGraph', () => {
  it('collects one selection set together with its inline fragments', () => {
    const { fieldSetsToCheck, petFieldSet } = graphFor(`
      {
        pet {
          name
          ... on Cat { name child { name } }
        }
      }
    `);

    expect(fieldSetsToCheck).to.include(petFieldSet);
    expect(
      petFieldSet.getFieldGroupsByResponseName().get('name')?.getFields(),
    ).to.have.length(2);
  });

  it('records repeated fragment spreads', () => {
    const { petFieldSet } = graphFor(`
      { pet { ...F ...F } }
      fragment F on Pet { value(arg: 1) }
    `);

    expect(petFieldSet.getFragmentSpreadsByName().get('F')).to.have.length(2);
  });

  it('expands each named fragment once', () => {
    const { graph, petFieldSet } = graphFor(`
      query {
        pet { name ...F ...F ...Unknown }
      }
      fragment F on Pet { value(arg: 1) ...G }
      fragment G on Pet { child { name } }
    `);

    const expanded = Array.from(
      graph.getEffectiveFieldSet(new Set([petFieldSet])).getFieldSets(),
    );

    expect(expanded).to.have.length(3);
    expect(expanded[1]?.getFieldGroupsByResponseName().has('value')).to.equal(
      true,
    );
    expect(expanded[2]?.getFieldGroupsByResponseName().has('child')).to.equal(
      true,
    );
  });

  it('expands fragment bodies before their definitions are visited', () => {
    const fragmentFieldSet = fragmentFieldSetBeforeDefinition(
      `{ pet { ...F } } fragment F on Pet { value(arg: 1) }`,
      'F',
      'value',
    );

    expect(fragmentFieldSet).not.to.equal(undefined);
  });

  it('expands unknown-type fragments before their definitions are visited', () => {
    const fragmentFieldSet = fragmentFieldSetBeforeDefinition(
      `{ pet { ...F } } fragment F on Missing { field }`,
      'F',
      'field',
    );

    expect(fragmentFieldSet?.parentType).to.equal(undefined);
  });

  it('terminates fragment cycles', () => {
    const { graph, petFieldSet } = graphFor(`
      { pet { name ...F } }
      fragment F on Pet { value(arg: 1) ...G }
      fragment G on Pet { child { name } ...F }
    `);

    expect(
      graph.getEffectiveFieldSet(new Set([petFieldSet])).getFieldSets().size,
    ).to.equal(3);
  });

  it('caches effective field sets for one starting field set', () => {
    const { graph, petFieldSet } = graphFor('{ pet { name } }');

    const effective = graph.getEffectiveFieldSet(new Set([petFieldSet]));

    expect(graph.getEffectiveFieldSet(new Set([petFieldSet]))).to.equal(
      effective,
    );
  });

  it('distinguishes operation and fragment variable scopes', () => {
    const { graph, petFieldSet } = graphFor(`
      query ($x: Int) { pet { ...F(x: $x) ...F(x: $x) } }
      fragment F($x: Int) on Pet {
        value(arg: $x)
        ...G(x: $x)
      }
      fragment G($x: Int) on Pet { child { name } }
    `);
    const expanded = Array.from(
      graph.getEffectiveFieldSet(new Set([petFieldSet])).getFieldSets(),
    );
    const firstSpread = petFieldSet.getFragmentSpreadsByName().get('F')?.[0];
    const valueField = expanded
      .flatMap(
        (fieldSet) =>
          fieldSet.getFieldGroupsByResponseName().get('value')?.getFields() ??
          [],
      )
      .at(0);

    expect(firstSpread?.argumentsKey).to.contain('operation');
    expect(valueField?.getArgumentsKey()).to.contain('fragment');
  });

  it('reuses bindings for identical fragment argument scopes', () => {
    const { graph, fieldSetsToCheck } = graphFor(`
      query ($x: Int) {
        pet { ...F(x: $x) }
        pet { ...F(x: $x) }
      }
      fragment F($x: Int) on Pet { value(arg: $x) }
    `);
    const petFieldSets = fieldSetsToCheck.filter(
      ({ parentType }) => parentType?.name === 'Pet',
    );
    const first = petFieldSets[0];
    const second = petFieldSets[1];
    const firstFragmentFieldSet =
      first === undefined
        ? undefined
        : Array.from(
            graph.getEffectiveFieldSet(new Set([first])).getFieldSets(),
          ).find((fieldSet) =>
            fieldSet.getFieldGroupsByResponseName().has('value'),
          );
    const secondFragmentFieldSet =
      second === undefined
        ? undefined
        : Array.from(
            graph.getEffectiveFieldSet(new Set([second])).getFieldSets(),
          ).find((fieldSet) =>
            fieldSet.getFieldGroupsByResponseName().has('value'),
          );

    expect(firstFragmentFieldSet).not.to.equal(undefined);
    expect(firstFragmentFieldSet).to.equal(secondFragmentFieldSet);
  });

  it('keys nested spreads by their lexical variable scope', () => {
    const { graph, petFieldSet } = graphFor(`
      query ($x: Int) { pet { ...F(x: $x) } }
      fragment F($x: Int) on Pet { ...G(x: $x) }
      fragment G($x: Int) on Pet { child { name } }
    `);
    const nestedSpread = graph.getEffectiveFieldSet(new Set([petFieldSet]));
    const nestedSpreadOccurrence = Array.from(nestedSpread.getFieldSets())
      .flatMap((fieldSet) => fieldSet.getFragmentSpreadsByName().get('G') ?? [])
      .at(0);

    expect(nestedSpreadOccurrence?.argumentsKey).to.contain('fragment');
  });

  it('keeps forwarded variable identities compact', () => {
    const fragments = Array.from({ length: 30 }, (_, index) => {
      const selection =
        index === 29 ? 'value(arg: $x)' : `...F${index + 1}(x: $x)`;
      return `fragment F${index}($x: Int) on Pet { ${selection} }`;
    }).join('\n');
    const { graph, petFieldSet } = graphFor(`
      query ($x: Int) { pet { ...F0(x: $x) ...F0(x: $x) } }
      ${fragments}
    `);

    const effective = graph.getEffectiveFieldSet(new Set([petFieldSet]));
    const value = Array.from(effective.getFieldSets())
      .flatMap(
        (fieldSet) =>
          fieldSet.getFieldGroupsByResponseName().get('value')?.getFields() ??
          [],
      )
      .at(0);
    expect(value?.getArgumentsKey()).to.match(
      /^\[\["arg",\["Variable","fragment:\d+:x"\]\]\]$/,
    );
  });

  it('expands distinct fragments before their shared dependency', () => {
    const { graph, petFieldSet } = graphFor(`
      {
        pet { ...A ...A ...B }
      }
      fragment A on Pet { value(arg: 1) ...Shared }
      fragment B on Pet { value(arg: 1) ...Shared }
      fragment Shared on Pet { value(arg: 1) }
    `);
    const expanded = Array.from(
      graph.getEffectiveFieldSet(new Set([petFieldSet])).getFieldSets(),
    );

    expect(petFieldSet.getFragmentSpreadsByName().get('A')).to.have.length(2);
    expect(
      expanded.flatMap(
        (fieldSet) =>
          fieldSet.getFieldGroupsByResponseName().get('value')?.getFields() ??
          [],
      ),
    ).to.have.length(3);
    expect(
      expanded.flatMap(
        (fieldSet) => fieldSet.getFragmentSpreadsByName().get('Shared') ?? [],
      ),
    ).to.have.length(2);
  });

  it('indexes fields by abstract and concrete parents', () => {
    const { graph, petFieldSet } = graphFor(`
      {
        pet {
          result: name
          ... on Cat {
            result: child { name }
          }
        }
      }
    `);
    const fieldGroupsByResponseName = graph
      .getEffectiveFieldSet(new Set([petFieldSet]))
      .getOverlappingFieldGroupsByResponseName();
    const resultFieldGroup = fieldGroupsByResponseName.get('result')?.[0];

    expect(
      resultFieldGroup?.getParentTypeDetails().abstractFields,
    ).to.have.length(1);
    expect(
      resultFieldGroup?.getParentTypeDetails().fieldsByObjectType.size,
    ).to.equal(1);
  });

  it('indexes child selections by field occurrence', () => {
    const { graph, petFieldSet } = graphFor(`
      {
        pet {
          child { name }
          ... on Cat { child { name } }
        }
      }
    `);
    const childFields = graph
      .getEffectiveFieldSet(new Set([petFieldSet]))
      .getOverlappingFieldGroupsByResponseName()
      .get('child')?.[0];
    const startingSubfieldSets = graph.getSubfieldFieldSets(
      childFields?.getFields() ?? [],
    );
    const startingSubfieldList = Array.from(startingSubfieldSets);
    const effectiveSubfieldSet =
      graph.getEffectiveFieldSet(startingSubfieldSets);
    const subfieldSets = Array.from(effectiveSubfieldSet.getFieldSets());

    expect(startingSubfieldList[0]).not.to.equal(startingSubfieldList[1]);
    expect(subfieldSets).to.have.length(2);
    expect(
      subfieldSets[0]?.getFieldGroupsByResponseName().get('name')?.getFields(),
    ).to.have.length(1);
    expect(
      graph
        .getEffectiveFieldSet(
          graph.getSubfieldFieldSets(childFields?.getFields() ?? []),
        )
        .getFieldSets(),
    ).to.equal(effectiveSubfieldSet.getFieldSets());
  });

  it('traces descendants through child fields and fragment spreads', () => {
    const { graph, petFieldSet } = graphFor(`
      { pet { child { nested: child { ...F } } } }
      fragment F on Pet { name }
    `);
    const outerChild = petFieldSet
      .getFieldGroupsByResponseName()
      .get('child')
      ?.getFields()[0];
    const outerChildFieldSet = Array.from(
      graph.getSubfieldFieldSets(outerChild === undefined ? [] : [outerChild]),
    )[0];
    const nestedChild = outerChildFieldSet
      ?.getFieldGroupsByResponseName()
      .get('nested')
      ?.getFields()[0];
    const nestedChildFieldSets = graph.getSubfieldFieldSets(
      nestedChild === undefined ? [] : [nestedChild],
    );
    const name = Array.from(
      graph.getEffectiveFieldSet(nestedChildFieldSets).getFieldSets(),
    )
      .flatMap(
        (fieldSet) =>
          fieldSet.getFieldGroupsByResponseName().get('name')?.getFields() ??
          [],
      )
      .at(0);
    if (outerChild === undefined || name === undefined) {
      throw new Error('Expected child and descendant fields.');
    }

    expect(graph.fieldContainsDescendant(outerChild, name)).to.equal(true);
  });

  it('does not find descendants beneath a leaf field', () => {
    const { graph, petFieldSet } = graphFor(`
      { pet { name child { name } } }
    `);
    const fields = petFieldSet.getFieldGroupsByResponseName();
    const leaf = fields.get('name')?.getFields()[0];
    const child = fields.get('child')?.getFields()[0];
    const childFieldSet = Array.from(
      graph.getSubfieldFieldSets(child === undefined ? [] : [child]),
    )[0];
    const descendant = childFieldSet
      ?.getFieldGroupsByResponseName()
      .get('name')
      ?.getFields()[0];
    if (leaf === undefined || descendant === undefined) {
      throw new Error('Expected leaf and descendant fields.');
    }

    expect(graph.fieldContainsDescendant(leaf, descendant)).to.equal(false);
  });

  it('terminates ancestry searches through fragment cycles', () => {
    const { graph, petFieldSet } = graphFor(`
      { pet { name child { ...A } } }
      fragment A on Pet { ...B }
      fragment B on Pet { ...A }
    `);
    const fields = petFieldSet.getFieldGroupsByResponseName();
    const target = fields.get('name')?.getFields()[0];
    const child = fields.get('child')?.getFields()[0];
    if (child === undefined || target === undefined) {
      throw new Error('Expected child and target fields.');
    }

    expect(graph.fieldContainsDescendant(child, target)).to.equal(false);
  });

  it('collects child sets when the field type is unknown', () => {
    const { graph, petFieldSet } = graphFor(`
      { pet { unknown { name } unknown { name } } }
    `);
    const fieldSet = petFieldSet;
    const unknownField = fieldSet
      .getFieldGroupsByResponseName()
      .get('unknown')
      ?.getFields()[0];

    expect(unknownField?.getOutputType()).to.equal(undefined);
    expect(
      graph.getSubfieldFieldSets(
        unknownField === undefined ? [] : [unknownField],
      ).size,
    ).to.equal(1);
  });

  it('handles an empty starting field set', () => {
    const { graph } = graphFor('{ pet { name } }');

    const empty = graph.getEffectiveFieldSet(new Set());
    const overlappingFieldGroups =
      empty.getOverlappingFieldGroupsByResponseName();

    expect(empty.getFieldSets()).to.deep.equal(new Set());
    expect(overlappingFieldGroups.size).to.equal(0);
    expect(empty.getOverlappingFieldGroupsByResponseName()).to.equal(
      overlappingFieldGroups,
    );
    expect(graph.getEffectiveFieldSet(new Set())).to.equal(empty);
  });

  it('yields selection sets with unknown parent types', () => {
    const { fieldSetsToCheck } = graphFor(`
      { pet { name name } }
      fragment UnknownType on MissingType { field }
    `);

    expect(fieldSetsToCheck).to.have.length(3);
  });

  it('yields selection sets with unresolved fragment spreads', () => {
    const { fieldSetsToCheck } = graphFor(`
      { pet { name name } }
      fragment UnknownReference($value: Boolean) on Pet {
        ...MissingFragment(value: $value)
      }
    `);

    expect(fieldSetsToCheck).to.have.length(3);
  });

  it('yields every operation and fragment selection set', () => {
    const { fieldSetsToCheck } = graphFor(`
      { pet { name name } }
      fragment Root on Pet { ...Leaf }
      fragment Leaf on Pet { name }
      fragment CycleA on Pet { ...CycleB }
      fragment CycleB on Pet { ...CycleA }
    `);

    expect(fieldSetsToCheck).to.have.length(6);
  });
});
