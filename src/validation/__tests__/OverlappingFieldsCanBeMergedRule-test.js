import { expect } from 'chai';

import { describe, it } from 'mocha';

import invariant from '../../jsutils/invariant';

import { print } from '../../language/printer';

import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';

import type { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import { OverlappingFieldsCanBeMergedRule } from '../rules/OverlappingFieldsCanBeMergedRule';
import { validate } from '../validate';

import {
  expectValidationErrors,
  expectValidationErrorsWithSchema,
} from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(OverlappingFieldsCanBeMergedRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).to.deep.equal([]);
}

function expectErrorsWithSchema(schema: GraphQLSchema, queryStr: string) {
  return expectValidationErrorsWithSchema(
    schema,
    OverlappingFieldsCanBeMergedRule,
    queryStr,
  );
}

function expectValidWithSchema(schema: GraphQLSchema, queryStr: string) {
  expectErrorsWithSchema(schema, queryStr).to.deep.equal([]);
}

describe('Validate: Overlapping fields can be merged', () => {
  it('accepts several overlapping fields with identical values', () => {
    const schema = buildSchema('type Query { field(value: Int): String }');
    expectValidWithSchema(
      schema,
      '{ field(value: 1) field(value: 1) field(value: 1) }',
    );
  });
  it('compares nested input values with empty collections and block strings', () => {
    const schema = buildSchema(`
      input SomeInput {
        text: String
        children: [SomeInput]
      }
      type Query {
        someField(arg: SomeInput): String
      }
    `);

    expectValidWithSchema(
      schema,
      `
        {
          someField(arg: {
            text: """first line
second line"""
            children: [{ text: "value", children: [] }, {}]
          })
          someField(arg: {
            children: [{ children: [], text: "value" }, {}]
            text: """first line
second line"""
          })
        }
      `,
    );
  });

  it('distinguishes value kinds, string forms, and collection order', () => {
    const schema = buildSchema(
      'scalar Input type Query { field(value: Input): String }',
    );
    const values = [
      '1',
      '1.0',
      '"1"',
      '"""1"""',
      'true',
      'false',
      'null',
      'VALUE',
      '$value',
      '[]',
      '{}',
      '[1, 2]',
      '[2, 1]',
      '{ a: 1 }',
      '{ b: 1 }',
      '{ a: 2 }',
      '{ a: 1, a: 2 }',
      '{ a: 2, a: 1 }',
    ];
    for (const first of values) {
      for (const second of values) {
        const document = parse(
          `{ field(value: ${first}) field(value: ${second}) }`,
        );
        const errors = validate(schema, document, [
          OverlappingFieldsCanBeMergedRule,
        ]);
        expect(errors).to.have.lengthOf(first === second ? 0 : 1);
      }
    }
  });

  it('compares object fields without changing the source AST', () => {
    const schema = buildSchema(
      'scalar Input type Query { field(value: Input): String }',
    );
    const document = parse(`{
      field(value: { z: [{ b: 2, a: 1 }], a: true, a: false })
      field(value: { a: true, z: [{ a: 1, b: 2 }], a: false })
    }`);
    const before = print(document);
    expect(
      validate(schema, document, [OverlappingFieldsCanBeMergedRule]),
    ).to.deep.equal([]);
    expect(print(document)).to.equal(before);
  });
  it('reuses field and fragment comparisons across exclusive parents', () => {
    const schema = buildSchema(`
      type Query { pet: Pet }
      union Pet = Dog | Cat
      type Dog { box: Box }
      type Cat { box: Box }
      type Box { name: String }
    `);
    expectValidWithSchema(
      schema,
      `
      {
        pet {
          ... on Dog { box { name ...Details } }
          ... on Cat {
            box { name ...Details }
            box { name ...Details }
          }
        }
      }
      fragment Details on Box { name }
    `,
    );
  });

  it('keeps field definitions separate when a selection set is shared between types', () => {
    const schema = buildSchema(`
      type Query { node: Union }
      union Union = First | Second
      type First { value: Int }
      type Second { value: String }
    `);
    const document = parse(`
      { node { ...First ...Second } }
      fragment First on First { value }
      fragment Second on Second { value }
    `);
    const first = document.definitions[1];
    const second = document.definitions[2];
    invariant(first.kind === Kind.FRAGMENT_DEFINITION);
    invariant(second.kind === Kind.FRAGMENT_DEFINITION);
    const sharedDocument = {
      ...document,
      definitions: document.definitions.map((definition) =>
        definition === second
          ? { ...second, selectionSet: first.selectionSet }
          : definition,
      ),
    };
    expect(
      validate(schema, sharedDocument).map((error) => error.message),
    ).to.deep.equal([
      'Fields "value" conflict because they return conflicting types "Int" and "String". Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });
  it('reuses field comparisons when operations share a selection set', () => {
    const schema = buildSchema('type Query { field(arg: Int): String }');
    const document = parse(`
      query First { field(arg: 1) field(arg: 1) }
      query Second { field }
    `);
    const first = document.definitions[0];
    const second = document.definitions[1];
    invariant(first.kind === Kind.OPERATION_DEFINITION);
    invariant(second.kind === Kind.OPERATION_DEFINITION);
    expect(
      validate(schema, {
        ...document,
        definitions: [first, { ...second, selectionSet: first.selectionSet }],
      }),
    ).to.deep.equal([]);
  });

  it('unique fields', () => {
    expectValid(`
      fragment uniqueFields on Dog {
        name
        nickname
      }
    `);
  });

  it('identical fields', () => {
    expectValid(`
      fragment mergeIdenticalFields on Dog {
        name
        name
      }
    `);
  });

  it('identical fields with identical args', () => {
    expectValid(`
      fragment mergeIdenticalFieldsWithIdenticalArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand(dogCommand: SIT)
      }
    `);
  });

  it('identical fields with identical directives', () => {
    expectValid(`
      fragment mergeSameFieldsWithSameDirectives on Dog {
        name @include(if: true)
        name @include(if: true)
      }
    `);
  });

  it('different args with different aliases', () => {
    expectValid(`
      fragment differentArgsWithDifferentAliases on Dog {
        knowsSit: doesKnowCommand(dogCommand: SIT)
        knowsDown: doesKnowCommand(dogCommand: DOWN)
      }
    `);
  });

  it('different directives with different aliases', () => {
    expectValid(`
      fragment differentDirectivesWithDifferentAliases on Dog {
        nameIfTrue: name @include(if: true)
        nameIfFalse: name @include(if: false)
      }
    `);
  });

  it('different skip/include directives accepted', () => {
    // Note: Differing skip/include directives don't create an ambiguous return
    // value and are acceptable in conditions where differing runtime values
    // may have the same desired effect of including or skipping a field.
    expectValid(`
      fragment differentDirectivesWithDifferentAliases on Dog {
        name @include(if: true)
        name @include(if: false)
      }
    `);
  });

  it('Same aliases with different field targets', () => {
    expectErrors(`
      fragment sameAliasesWithDifferentFieldTargets on Dog {
        fido: name
        fido: nickname
      }
    `).to.deep.equal([
      {
        message:
          'Fields "fido" conflict because "name" and "nickname" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('Same aliases allowed on non-overlapping fields', () => {
    // This is valid since no object can be both a "Dog" and a "Cat", thus
    // these fields can never overlap.
    expectValid(`
      fragment sameAliasesWithDifferentFieldTargets on Pet {
        ... on Dog {
          name
        }
        ... on Cat {
          name: nickname
        }
      }
    `);
  });

  it('Alias masking direct field access', () => {
    expectErrors(`
      fragment aliasMaskingDirectFieldAccess on Dog {
        name: nickname
        name
      }
    `).to.deep.equal([
      {
        message:
          'Fields "name" conflict because "nickname" and "name" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different args, second adds an argument', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand
        doesKnowCommand(dogCommand: HEEL)
      }
    `).to.deep.equal([
      {
        message:
          'Fields "doesKnowCommand" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different args, second missing an argument', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand
      }
    `).to.deep.equal([
      {
        message:
          'Fields "doesKnowCommand" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('different args, first has two, second missing one', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT, atExpertLevel: true)
        doesKnowCommand(dogCommand: SIT)
      }
    `).to.deep.equal([
      {
        message:
          'Fields "doesKnowCommand" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('reports deep conflict after nested fragments', () => {
    expectErrors(`
      fragment F on T {
        ...G
      }
      fragment G on T {
        ...H
      }
      fragment H on T {
        x: a
      }
      {
        x: b
        ...F
      }
    `).to.deep.equal([
      {
        message:
          'Fields "x" conflict because "b" and "a" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 12, column: 9 },
          { line: 9, column: 9 },
        ],
      },
    ]);
  });

  it('ignores unknown fragments', () => {
    expectValid(`
      {
        field
        ...Unknown
        ...Known
      }

      fragment Known on T {
        field
        ...OtherUnknown
      }
    `);
  });

  it('does not infinite loop on recursive fragments separated by fields', () => {
    expectValid(`
      {
        ...fragA
        ...fragB
      }

      fragment fragA on T {
        x {
          ...fragA
          x {
            ...fragA
          }
        }
      }

      fragment fragB on T {
        x {
          ...fragB
          x {
            ...fragB
          }
        }
      }
    `);
  });

  it('conflicting arg values', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand(dogCommand: HEEL)
      }
    `).to.deep.equal([
      {
        message:
          'Fields "doesKnowCommand" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('conflicting arg names', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        isAtLocation(x: 0)
        isAtLocation(y: 0)
      }
    `).to.deep.equal([
      {
        message:
          'Fields "isAtLocation" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('allows different args where no conflict is possible', () => {
    // This is valid since no object can be both a "Dog" and a "Cat", thus
    // these fields can never overlap.
    expectValid(`
      fragment conflictingArgs on Pet {
        ... on Dog {
          name(surname: true)
        }
        ... on Cat {
          name
        }
      }
    `);
  });

  it('allows different order of args', () => {
    const schema = buildSchema(`
      type Query {
        someField(a: String, b: String): String
      }
    `);

    // This is valid since arguments are unordered, see:
    // https://spec.graphql.org/draft/#sec-Language.Arguments.Arguments-are-unordered
    expectValidWithSchema(
      schema,
      `
        {
          someField(a: null, b: null)
          someField(b: null, a: null)
        }
      `,
    );
  });

  it('allows different order of input object fields in arg values', () => {
    const schema = buildSchema(`
      input SomeInput {
        a: String
        b: String
      }

      type Query {
        someField(arg: SomeInput): String
      }
    `);

    // This is valid since input object fields are unordered, see:
    // https://spec.graphql.org/draft/#sec-Input-Object-Values.Input-object-fields-are-unordered
    expectValidWithSchema(
      schema,
      `
        {
          someField(arg: { a: null, b: null })
          someField(arg: { b: null, a: null })
        }
      `,
    );
  });

  it('encounters conflict in fragments', () => {
    expectErrors(`
      {
        ...A
        ...B
      }
      fragment A on Type {
        x: a
      }
      fragment B on Type {
        x: b
      }
    `).to.deep.equal([
      {
        message:
          'Fields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 7, column: 9 },
          { line: 10, column: 9 },
        ],
      },
    ]);
  });

  it('reports each conflict once', () => {
    expectErrors(`
      {
        f1 {
          ...A
          ...B
        }
        f2 {
          ...B
          ...A
        }
        f3 {
          ...A
          ...B
          x: c
        }
      }
      fragment A on Type {
        x: a
      }
      fragment B on Type {
        x: b
      }
    `).to.deep.equal([
      {
        message:
          'Fields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 18, column: 9 },
          { line: 21, column: 9 },
        ],
      },
      {
        message:
          'Fields "x" conflict because "c" and "a" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 14, column: 11 },
          { line: 18, column: 9 },
        ],
      },
      {
        message:
          'Fields "x" conflict because "c" and "b" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 14, column: 11 },
          { line: 21, column: 9 },
        ],
      },
    ]);
  });

  it('deep conflict', () => {
    expectErrors(`
      {
        field {
          x: a
        },
        field {
          x: b
        }
      }
    `).to.deep.equal([
      {
        message:
          'Fields "field" conflict because subfields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 11 },
          { line: 6, column: 9 },
          { line: 7, column: 11 },
        ],
      },
    ]);
  });

  it('deep conflict with multiple issues', () => {
    expectErrors(`
      {
        field {
          x: a
          y: c
        },
        field {
          x: b
          y: d
        }
      }
    `).to.deep.equal([
      {
        message:
          'Fields "field" conflict because subfields "x" conflict because "a" and "b" are different fields and subfields "y" conflict because "c" and "d" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 11 },
          { line: 5, column: 11 },
          { line: 7, column: 9 },
          { line: 8, column: 11 },
          { line: 9, column: 11 },
        ],
      },
    ]);
  });

  it('does not compare subfields of incompatible parent calls', () => {
    expectErrors(`
      fragment incompatibleParents on Dog {
        parent: mother {
          value: name
        }
        parent: father {
          value: mother { name }
        }
      }
    `).to.deep.equal([
      {
        message:
          'Fields "parent" conflict because "mother" and "father" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 6, column: 9 },
        ],
      },
    ]);
  });

  it('still compares subfields of each compatible parent-call group', () => {
    expectErrors(`
      fragment mixedParents on Dog {
        parent: mother {
          value: name
        }
        parent: mother {
          value: mother { name }
        }
        parent: father { name }
      }
    `).to.deep.equal([
      {
        message:
          'Fields "parent" conflict because subfields "value" conflict because "name" and "mother" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 11 },
          { line: 6, column: 9 },
          { line: 7, column: 11 },
        ],
      },
      {
        message:
          'Fields "parent" conflict because "mother" and "father" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 9, column: 9 },
        ],
      },
      {
        message:
          'Fields "parent" conflict because "mother" and "father" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 6, column: 9 },
          { line: 9, column: 9 },
        ],
      },
    ]);
  });

  it('very deep conflict', () => {
    expectErrors(`
      {
        field {
          deepField {
            x: a
          }
        },
        field {
          deepField {
            x: b
          }
        }
      }
    `).to.deep.equal([
      {
        message:
          'Fields "field" conflict because subfields "deepField" conflict because subfields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 11 },
          { line: 5, column: 13 },
          { line: 8, column: 9 },
          { line: 9, column: 11 },
          { line: 10, column: 13 },
        ],
      },
    ]);
  });

  it('reports deep conflict to nearest common ancestor', () => {
    expectErrors(`
      {
        field {
          deepField {
            x: a
          }
          deepField {
            x: b
          }
        },
        field {
          deepField {
            y
          }
        }
      }
    `).to.deep.equal([
      {
        message:
          'Fields "deepField" conflict because subfields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 4, column: 11 },
          { line: 5, column: 13 },
          { line: 7, column: 11 },
          { line: 8, column: 13 },
        ],
      },
    ]);
  });

  it('reports deep conflict to nearest common ancestor in fragments', () => {
    expectErrors(`
      {
        field {
          ...F
        }
        field {
          ...F
        }
      }
      fragment F on T {
        deepField {
          deeperField {
            x: a
          }
          deeperField {
            x: b
          }
        },
        deepField {
          deeperField {
            y
          }
        }
      }
    `).to.deep.equal([
      {
        message:
          'Fields "deeperField" conflict because subfields "x" conflict because "a" and "b" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 12, column: 11 },
          { line: 13, column: 13 },
          { line: 15, column: 11 },
          { line: 16, column: 13 },
        ],
      },
    ]);
  });

  it('reports deep conflict in nested fragments', () => {
    expectErrors(`
      {
        field {
          ...I
        }
        field {
          ...F
        }
      }
      fragment F on T {
        x: a
        ...G
      }
      fragment G on T {
        y: c
      }
      fragment I on T {
        y: d
        ...J
      }
      fragment J on T {
        x: b
      }
    `).to.deep.equal([
      {
        message:
          'Fields "field" conflict because subfields "y" conflict because "d" and "c" are different fields and subfields "x" conflict because "b" and "a" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 18, column: 9 },
          { line: 22, column: 9 },
          { line: 6, column: 9 },
          { line: 15, column: 9 },
          { line: 11, column: 9 },
        ],
      },
    ]);
  });

  it('ignores unknown fragments', () => {
    expectValid(`
      {
        field
        ...Unknown
        ...Known
      }

      fragment Known on T {
        field
        ...OtherUnknown
      }
    `);
  });

  describe('return types must be unambiguous', () => {
    const schema = buildSchema(`
      interface SomeBox {
        deepBox: SomeBox
        unrelatedField: String
      }

      type StringBox implements SomeBox {
        scalar: String
        deepBox: StringBox
        unrelatedField: String
        listNode: [Node]
        listStringBox: [StringBox]
        stringBox: StringBox
        intBox: IntBox
      }

      type IntBox implements SomeBox {
        scalar: Int
        deepBox: IntBox
        unrelatedField: String
        node: Node
        listStringBox: [StringBox]
        stringBox: StringBox
        intBox: IntBox
      }

      interface NonNullStringBox1 {
        scalar: String!
      }

      type NonNullStringBox1Impl implements SomeBox & NonNullStringBox1 {
        scalar: String!
        unrelatedField: String
        deepBox: SomeBox
      }

      interface NonNullStringBox2 {
        scalar: String!
      }

      type NonNullStringBox2Impl implements SomeBox & NonNullStringBox2 {
        scalar: String!
        unrelatedField: String
        deepBox: SomeBox
      }

      type Connection {
        edges: [Edge]
      }

      type Edge {
        node: Node
      }

      type Node {
        id: ID
        name: String
      }

      type Query {
        someBox: SomeBox
        connection: Connection
      }
    `);

    it('conflicting return types which potentially overlap', () => {
      // This is invalid since an object could potentially be both the Object
      // type IntBox and the interface type NonNullStringBox1. While that
      // condition does not exist in the current schema, the schema could
      // expand in the future to allow this. Thus it is invalid.
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ...on IntBox {
                scalar
              }
              ...on NonNullStringBox1 {
                scalar
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message:
            'Fields "scalar" conflict because they return conflicting types "Int" and "String!". Use different aliases on the fields to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 8, column: 17 },
          ],
        },
      ]);
    });

    it('compatible return shapes on different return types', () => {
      // In this case `deepBox` returns `SomeBox` in the first usage, and
      // `StringBox` in the second usage. These return types are not the same!
      // however this is valid because the return *shapes* are compatible.
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ... on SomeBox {
                deepBox {
                  unrelatedField
                }
              }
              ... on StringBox {
                deepBox {
                  unrelatedField
                }
              }
            }
          }
        `,
      );
    });

    it('disallows differing return types despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                scalar
              }
              ... on StringBox {
                scalar
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message:
            'Fields "scalar" conflict because they return conflicting types "Int" and "String". Use different aliases on the fields to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 8, column: 17 },
          ],
        },
      ]);
    });

    it('does not compare subfields after a response-type conflict', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on StringBox {
                parent: listNode { value: name }
              }
              ... on IntBox {
                parent: node { value: id }
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message:
            'Fields "parent" conflict because they return conflicting types "[Node]" and "Node". Use different aliases on the fields to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 8, column: 17 },
          ],
        },
      ]);
    });

    it('reports correctly when a non-exclusive follows an exclusive', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                deepBox {
                  ...X
                }
              }
            }
            someBox {
              ... on StringBox {
                deepBox {
                  ...Y
                }
              }
            }
            memoed: someBox {
              ... on IntBox {
                deepBox {
                  ...X
                }
              }
            }
            memoed: someBox {
              ... on StringBox {
                deepBox {
                  ...Y
                }
              }
            }
            other: someBox {
              ...X
            }
            other: someBox {
              ...Y
            }
          }
          fragment X on SomeBox {
            scalar
          }
          fragment Y on SomeBox {
            scalar: unrelatedField
          }
        `,
      ).to.deep.equal([
        {
          message:
            'Fields "other" conflict because subfields "scalar" conflict because "scalar" and "unrelatedField" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
          locations: [
            { line: 31, column: 13 },
            { line: 39, column: 13 },
            { line: 34, column: 13 },
            { line: 42, column: 13 },
          ],
        },
      ]);
    });

    it('disallows differing return type nullability despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on NonNullStringBox1 {
                scalar
              }
              ... on StringBox {
                scalar
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message:
            'Fields "scalar" conflict because they return conflicting types "String!" and "String". Use different aliases on the fields to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 8, column: 17 },
          ],
        },
      ]);
    });

    it('disallows differing return type list despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: listStringBox {
                  scalar
                }
              }
              ... on StringBox {
                box: stringBox {
                  scalar
                }
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message:
            'Fields "box" conflict because they return conflicting types "[StringBox]" and "StringBox". Use different aliases on the fields to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 10, column: 17 },
          ],
        },
      ]);

      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: stringBox {
                  scalar
                }
              }
              ... on StringBox {
                box: listStringBox {
                  scalar
                }
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message:
            'Fields "box" conflict because they return conflicting types "StringBox" and "[StringBox]". Use different aliases on the fields to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 10, column: 17 },
          ],
        },
      ]);
    });

    it('disallows differing subfields', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: stringBox {
                  val: scalar
                  val: unrelatedField
                }
              }
              ... on StringBox {
                box: stringBox {
                  val: scalar
                }
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message:
            'Fields "val" conflict because "scalar" and "unrelatedField" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
          locations: [
            { line: 6, column: 19 },
            { line: 7, column: 19 },
          ],
        },
      ]);
    });

    it('disallows differing deep return types despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: stringBox {
                  scalar
                }
              }
              ... on StringBox {
                box: intBox {
                  scalar
                }
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message:
            'Fields "box" conflict because subfields "scalar" conflict because they return conflicting types "String" and "Int". Use different aliases on the fields to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 17 },
            { line: 6, column: 19 },
            { line: 10, column: 17 },
            { line: 11, column: 19 },
          ],
        },
      ]);
    });

    it('allows non-conflicting overlapping types', () => {
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                scalar: unrelatedField
              }
              ... on StringBox {
                scalar
              }
            }
          }
        `,
      );
    });

    it('same wrapped scalar return types', () => {
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ...on NonNullStringBox1 {
                scalar
              }
              ...on NonNullStringBox2 {
                scalar
              }
            }
          }
        `,
      );
    });

    it('allows inline fragments without type condition', () => {
      expectValidWithSchema(
        schema,
        `
          {
            a
            ... {
              a
            }
          }
        `,
      );
    });

    it('compares deep types including list', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            connection {
              ...edgeID
              edges {
                node {
                  id: name
                }
              }
            }
          }

          fragment edgeID on Connection {
            edges {
              node {
                id
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message:
            'Fields "edges" conflict because subfields "node" conflict because subfields "id" conflict because "name" and "id" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
          locations: [
            { line: 5, column: 15 },
            { line: 6, column: 17 },
            { line: 7, column: 19 },
            { line: 14, column: 13 },
            { line: 15, column: 15 },
            { line: 16, column: 17 },
          ],
        },
      ]);
    });

    it('ignores unknown types', () => {
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ...on UnknownType {
                scalar
              }
              ...on NonNullStringBox2 {
                scalar
              }
            }
          }
        `,
      );
    });

    it('works for field names that are JS keywords', () => {
      const schemaWithKeywords = buildSchema(`
        type Foo {
          constructor: String
        }

        type Query {
          foo: Foo
        }
      `);

      expectValidWithSchema(
        schemaWithKeywords,
        `
          {
            foo {
              constructor
            }
          }
        `,
      );
    });
  });

  it('does not infinite loop on recursive fragment', () => {
    expectValid(`
      {
        ...fragA
      }

      fragment fragA on Human { name, relatives { name, ...fragA } }
    `);
  });

  it('does not infinite loop on immediately recursive fragment', () => {
    expectValid(`
      {
        ...fragA
      }

      fragment fragA on Human { name, ...fragA }
    `);
  });

  it('does not infinite loop on recursive fragment with a field named after fragment', () => {
    expectValid(`
      {
        ...fragA
        fragA
      }

      fragment fragA on Query { ...fragA }
    `);
  });

  it('finds invalid cases even with field named after fragment', () => {
    expectErrors(`
      {
        fragA
        ...fragA
      }

      fragment fragA on Type {
        fragA: b
      }
    `).to.deep.equal([
      {
        message:
          'Fields "fragA" conflict because "fragA" and "b" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 3, column: 9 },
          { line: 8, column: 9 },
        ],
      },
    ]);
  });

  it('does not infinite loop on transitively recursive fragment', () => {
    expectValid(`
      {
        ...fragA
        fragB
      }

      fragment fragA on Human { name, ...fragB }
      fragment fragB on Human { name, ...fragC }
      fragment fragC on Human { name, ...fragA }
    `);
  });

  it('finds invalid case even with immediately recursive fragment', () => {
    expectErrors(`
      fragment sameAliasesWithDifferentFieldTargets on Dog {
        ...sameAliasesWithDifferentFieldTargets
        fido: name
        fido: nickname
      }
    `).to.deep.equal([
      {
        message:
          'Fields "fido" conflict because "name" and "nickname" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
        locations: [
          { line: 4, column: 9 },
          { line: 5, column: 9 },
        ],
      },
    ]);
  });

  it('rechecks field-to-fragment comparisons when parents can overlap', () => {
    const schema = buildSchema(`
      type Query { item: Item }
      interface Item { child: Leaf }
      type A implements Item { child: Leaf }
      type B implements Item { child: Leaf }
      type Leaf { first: Int second: Int }
    `);
    const errors = validate(
      schema,
      parse(`
        {
          item {
            ...Left
            ... on B { child { ...Right ...RightAgain } }
          }
          other: item {
            ...Left
            ... on A { child { ...Right } }
          }
        }
        fragment Left on A { child { value: first } }
        fragment Right on Leaf { value: second }
        fragment RightAgain on Leaf { ...Right }
      `),
      [OverlappingFieldsCanBeMergedRule],
    );
    expect(errors).to.have.lengthOf(1);
    expect(errors[0].message).to.equal(
      'Fields "child" conflict because subfields "value" conflict because "first" and "second" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    );
  });
});
