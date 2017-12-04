/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  expectPassesRule,
  expectFailsRule,
  expectFailsRuleWithSchema,
  expectPassesRuleWithSchema
} from './harness';
import {
  OverlappingFieldsCanBeMerged,
  fieldsConflictMessage,
} from '../rules/OverlappingFieldsCanBeMerged';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLString,
  GraphQLID,
} from '../../type';

describe('Validate: Overlapping fields can be merged', () => {

  it('unique fields', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment uniqueFields on Dog {
        name
        nickname
      }
    `);
  });

  it('identical fields', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment mergeIdenticalFields on Dog {
        name
        name
      }
    `);
  });

  it('identical fields with identical args', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment mergeIdenticalFieldsWithIdenticalArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand(dogCommand: SIT)
      }
    `);
  });

  it('identical fields with identical directives', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment mergeSameFieldsWithSameDirectives on Dog {
        name @include(if: true)
        name @include(if: true)
      }
    `);
  });

  it('different args with different aliases', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment differentArgsWithDifferentAliases on Dog {
        knowsSit: doesKnowCommand(dogCommand: SIT)
        knowsDown: doesKnowCommand(dogCommand: DOWN)
      }
    `);
  });

  it('different directives with different aliases', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
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
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment differentDirectivesWithDifferentAliases on Dog {
        name @include(if: true)
        name @include(if: false)
      }
    `);
  });

  it('Same aliases with different field targets', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment sameAliasesWithDifferentFieldTargets on Dog {
        fido: name
        fido: nickname
      }
    `, [
      { message: fieldsConflictMessage(
          'fido',
          'name and nickname are different fields'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ],
        path: undefined }
    ]);
  });

  it('Same aliases allowed on non-overlapping fields', () => {
    // This is valid since no object can be both a "Dog" and a "Cat", thus
    // these fields can never overlap.
    expectPassesRule(OverlappingFieldsCanBeMerged, `
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
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment aliasMaskingDirectFieldAccess on Dog {
        name: nickname
        name
      }
    `, [
      { message: fieldsConflictMessage(
          'name',
          'nickname and name are different fields'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ],
        path: undefined }
    ]);
  });

  it('different args, second adds an argument', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment conflictingArgs on Dog {
        doesKnowCommand
        doesKnowCommand(dogCommand: HEEL)
      }
    `, [
      { message: fieldsConflictMessage(
          'doesKnowCommand',
          'they have differing arguments'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ],
        path: undefined }
    ]);
  });

  it('different args, second missing an argument', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand
      }
    `, [
      { message: fieldsConflictMessage(
          'doesKnowCommand',
          'they have differing arguments'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ],
        path: undefined }
    ]);
  });

  it('conflicting args', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand(dogCommand: HEEL)
      }
    `, [
      { message: fieldsConflictMessage(
          'doesKnowCommand',
          'they have differing arguments'
        ),
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ],
        path: undefined }
    ]);
  });

  it('allows different args where no conflict is possible', () => {
    // This is valid since no object can be both a "Dog" and a "Cat", thus
    // these fields can never overlap.
    expectPassesRule(OverlappingFieldsCanBeMerged, `
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

  it('encounters conflict in fragments', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
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
    `, [
      { message: fieldsConflictMessage('x', 'a and b are different fields'),
        locations: [ { line: 7, column: 9 }, { line: 10, column: 9 } ],
        path: undefined }
    ]);
  });

  it('reports each conflict once', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
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
    `, [
      { message: fieldsConflictMessage('x', 'a and b are different fields'),
        locations: [ { line: 18, column: 9 }, { line: 21, column: 9 } ],
        path: undefined },
      { message: fieldsConflictMessage('x', 'c and a are different fields'),
        locations: [ { line: 14, column: 11 }, { line: 18, column: 9 } ],
        path: undefined },
      { message: fieldsConflictMessage('x', 'c and b are different fields'),
        locations: [ { line: 14, column: 11 }, { line: 21, column: 9 } ],
        path: undefined }
    ]);
  });

  it('deep conflict', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      {
        field {
          x: a
        },
        field {
          x: b
        }
      }
    `, [
      { message: fieldsConflictMessage(
          'field', [ [ 'x', 'a and b are different fields' ] ]
        ),
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 11 },
          { line: 6, column: 9 },
          { line: 7, column: 11 } ],
        path: undefined },
    ]);
  });

  it('deep conflict with multiple issues', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
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
    `, [
      { message: fieldsConflictMessage(
          'field', [
            [ 'x', 'a and b are different fields' ],
            [ 'y', 'c and d are different fields' ]
          ]
        ),
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 11 },
          { line: 5, column: 11 },
          { line: 7, column: 9 },
          { line: 8, column: 11 },
          { line: 9, column: 11 } ],
        path: undefined },
    ]);
  });

  it('very deep conflict', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
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
    `, [
      { message: fieldsConflictMessage(
          'field',
          [ [ 'deepField', [ [ 'x', 'a and b are different fields' ] ] ] ]
        ),
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 11 },
          { line: 5, column: 13 },
          { line: 8, column: 9 },
          { line: 9, column: 11 },
          { line: 10, column: 13 } ],
        path: undefined },
    ]);
  });

  it('reports deep conflict to nearest common ancestor', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
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
    `, [
      { message: fieldsConflictMessage(
          'deepField', [ [ 'x', 'a and b are different fields' ] ]
        ),
        locations: [
          { line: 4, column: 11 },
          { line: 5, column: 13 },
          { line: 7, column: 11 },
          { line: 8, column: 13 } ],
        path: undefined },
    ]);
  });

  it('reports deep conflict to nearest common ancestor in fragments', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
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
    `, [
      { message: fieldsConflictMessage(
          'deeperField', [ [ 'x', 'a and b are different fields' ] ]
        ),
        locations: [
          { line: 12, column: 11 },
          { line: 13, column: 13 },
          { line: 15, column: 11 },
          { line: 16, column: 13 } ],
        path: undefined },
    ]);
  });

  it('reports deep conflict in nested fragments', () => {
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      {
        field {
          ...F
        }
        field {
          ...I
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
    `, [
      { message: fieldsConflictMessage(
          'field', [ [ 'x', 'a and b are different fields' ],
                     [ 'y', 'c and d are different fields' ] ]
        ),
        locations: [
          { line: 3, column: 9 },
          { line: 11, column: 9 },
          { line: 15, column: 9 },
          { line: 6, column: 9 },
          { line: 22, column: 9 },
          { line: 18, column: 9 } ],
        path: undefined },
    ]);
  });

  it('ignores unknown fragments', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
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

    const SomeBox = new GraphQLInterfaceType({
      name: 'SomeBox',
      fields: () => ({
        deepBox: { type: SomeBox },
        unrelatedField: { type: GraphQLString }
      })
    });

    const StringBox = new GraphQLObjectType({
      name: 'StringBox',
      interfaces: [ SomeBox ],
      fields: () => ({
        scalar: { type: GraphQLString },
        deepBox: { type: StringBox },
        unrelatedField: { type: GraphQLString },
        listStringBox: { type: new GraphQLList(StringBox) },
        stringBox: { type: StringBox },
        intBox: { type: IntBox },
      })
    });

    const IntBox = new GraphQLObjectType({
      name: 'IntBox',
      interfaces: [ SomeBox ],
      fields: () => ({
        scalar: { type: GraphQLInt },
        deepBox: { type: IntBox },
        unrelatedField: { type: GraphQLString },
        listStringBox: { type: new GraphQLList(StringBox) },
        stringBox: { type: StringBox },
        intBox: { type: IntBox },
      })
    });

    const NonNullStringBox1 = new GraphQLInterfaceType({
      name: 'NonNullStringBox1',
      fields: {
        scalar: { type: new GraphQLNonNull(GraphQLString) }
      }
    });

    const NonNullStringBox1Impl = new GraphQLObjectType({
      name: 'NonNullStringBox1Impl',
      interfaces: [ SomeBox, NonNullStringBox1 ],
      fields: {
        scalar: { type: new GraphQLNonNull(GraphQLString) },
        unrelatedField: { type: GraphQLString },
        deepBox: { type: SomeBox },
      }
    });

    const NonNullStringBox2 = new GraphQLInterfaceType({
      name: 'NonNullStringBox2',
      fields: {
        scalar: { type: new GraphQLNonNull(GraphQLString) }
      }
    });

    const NonNullStringBox2Impl = new GraphQLObjectType({
      name: 'NonNullStringBox2Impl',
      interfaces: [ SomeBox, NonNullStringBox2 ],
      fields: {
        scalar: { type: new GraphQLNonNull(GraphQLString) },
        unrelatedField: { type: GraphQLString },
        deepBox: { type: SomeBox },
      }
    });

    const Connection = new GraphQLObjectType({
      name: 'Connection',
      fields: {
        edges: {
          type: new GraphQLList(new GraphQLObjectType({
            name: 'Edge',
            fields: {
              node: {
                type: new GraphQLObjectType({
                  name: 'Node',
                  fields: {
                    id: { type: GraphQLID },
                    name: { type: GraphQLString }
                  }
                })
              }
            }
          }))
        }
      }
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'QueryRoot',
        fields: () => ({
          someBox: { type: SomeBox },
          connection: { type: Connection }
        })
      }),
      types: [ IntBox, StringBox, NonNullStringBox1Impl, NonNullStringBox2Impl ]
    });

    it('conflicting return types which potentially overlap', () => {
      // This is invalid since an object could potentially be both the Object
      // type IntBox and the interface type NonNullStringBox1. While that
      // condition does not exist in the current schema, the schema could
      // expand in the future to allow this. Thus it is invalid.
      expectFailsRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `, [
        { message: fieldsConflictMessage(
            'scalar',
            'they return conflicting types Int and String!'
          ),
          locations: [ { line: 5, column: 15 }, { line: 8, column: 15 } ],
          path: undefined }
      ]);
    });

    it('compatible return shapes on different return types', () => {
      // In this case `deepBox` returns `SomeBox` in the first usage, and
      // `StringBox` in the second usage. These return types are not the same!
      // however this is valid because the return *shapes* are compatible.
      expectPassesRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `);
    });

    it('disallows differing return types despite no overlap', () => {
      expectFailsRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `, [
        { message: fieldsConflictMessage(
            'scalar',
            'they return conflicting types Int and String'
          ),
          locations: [ { line: 5, column: 15 }, { line: 8, column: 15 } ],
          path: undefined }
      ]);
    });

    it('reports correctly when a non-exclusive follows an exclusive', () => {
      expectFailsRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `, [
        { message: fieldsConflictMessage(
            'other',
            [ [ 'scalar', 'scalar and unrelatedField are different fields' ] ]
          ),
          locations: [
            { line: 31, column: 11 },
            { line: 39, column: 11 },
            { line: 34, column: 11 },
            { line: 42, column: 11 },
          ],
          path: undefined }
      ]);
    });

    it('disallows differing return type nullability despite no overlap', () => {
      expectFailsRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `, [
        { message: fieldsConflictMessage(
            'scalar',
            'they return conflicting types String! and String'
          ),
          locations: [ { line: 5, column: 15 }, { line: 8, column: 15 } ],
          path: undefined }
      ]);
    });

    it('disallows differing return type list despite no overlap', () => {
      expectFailsRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `, [
        { message: fieldsConflictMessage(
            'box',
            'they return conflicting types [StringBox] and StringBox'
          ),
          locations: [ { line: 5, column: 15 }, { line: 10, column: 15 } ],
          path: undefined }
      ]);

      expectFailsRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `, [
        { message: fieldsConflictMessage(
            'box',
            'they return conflicting types StringBox and [StringBox]'
          ),
          locations: [ { line: 5, column: 15 }, { line: 10, column: 15 } ],
          path: undefined }
      ]);
    });

    it('disallows differing subfields', () => {
      expectFailsRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `, [
        { message: fieldsConflictMessage(
            'val',
            'scalar and unrelatedField are different fields'
          ),
          locations: [ { line: 6, column: 17 }, { line: 7, column: 17 } ],
          path: undefined }
      ]);
    });

    it('disallows differing deep return types despite no overlap', () => {
      expectFailsRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `, [
        { message: fieldsConflictMessage(
            'box',
            [ [ 'scalar', 'they return conflicting types String and Int' ] ]
          ),
          locations: [
            { line: 5, column: 15 },
            { line: 6, column: 17 },
            { line: 10, column: 15 },
            { line: 11, column: 17 } ],
          path: undefined }
      ]);
    });

    it('allows non-conflicting overlaping types', () => {
      expectPassesRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `);
    });

    it('same wrapped scalar return types', () => {
      expectPassesRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `);
    });

    it('allows inline typeless fragments', () => {
      expectPassesRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
        {
          a
          ... {
            a
          }
        }
      `);
    });

    it('compares deep types including list', () => {
      expectFailsRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `, [
        { message: fieldsConflictMessage(
            'edges',
            [ [ 'node', [ [ 'id', 'name and id are different fields' ] ] ] ]
          ),
          locations: [
            { line: 5, column: 13 },
            { line: 6, column: 15 },
            { line: 7, column: 17 },
            { line: 14, column: 11 },
            { line: 15, column: 13 },
            { line: 16, column: 15 },
          ],
          path: undefined }
      ]);
    });

    it('ignores unknown types', () => {
      expectPassesRuleWithSchema(schema, OverlappingFieldsCanBeMerged, `
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
      `);
    });

    it('error message contains hint for alias conflict', () => {
      // The error template should end with a hint for the user to try using
      // different aliases.
      const error = fieldsConflictMessage('x', 'a and b are different fields');
      expect(error).to.equal(
        'Fields "x" conflict because a and b are different fields. Use ' +
        'different aliases on the fields to fetch both if this was intentional.'
      );
    });

    it('works for field names that are JS keywords', () => {
      const FooType = new GraphQLObjectType({
        name: 'Foo',
        fields: {
          constructor: {
            type: GraphQLString
          },
        }
      });

      const schemaWithKeywords = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: () => ({
            foo: { type: FooType },
          })
        }),
      });

      expectPassesRuleWithSchema(
        schemaWithKeywords,
        OverlappingFieldsCanBeMerged,
        `{
          foo {
            constructor
          }
        }`
      );
    });
  });

  it('does not infinite loop on recursive fragment', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment fragA on Human {name relatives { name ...fragA } },
    `);
  });

  it('does not infinite loop on immediately spread fragment', () => {
    expectPassesRule(OverlappingFieldsCanBeMerged, `
      fragment fragA on Human {name ...fragA },
    `);
  });

  it('finds invalid case even with immediately spread fragment', () => {
    // You would not expect this to have three error messages, and you would be
    // right. The trickiness here is that we don't detect the immediate spread
    // on first spreading, because it's in the context of the selection set. So
    // by the time we detect and eliminate it, we've already spread it in once,
    // and hence we get multiple error messages. We could change the algorithm
    // to track that we're in an immediate fragment spread, but that would add
    // complexity that only is needed in this error case.

    // Because this is an invalid query by another rule (NoFragmentCycles), I'm
    // not too worried about this case... and since we used to infinite loop,
    // this is strictly better.
    expectFailsRule(OverlappingFieldsCanBeMerged, `
      fragment sameAliasesWithDifferentFieldTargets on Dog {
        ...sameAliasesWithDifferentFieldTargets
        fido: name
        fido: nickname
      }
    `, [
      { message: fieldsConflictMessage(
          'fido',
          'name and nickname are different fields'
        ),
        locations: [ { line: 4, column: 9 }, { line: 5, column: 9 } ],
        path: undefined },
      { message: fieldsConflictMessage(
          'fido',
          'name and nickname are different fields'
        ),
        locations: [ { line: 4, column: 9 }, { line: 5, column: 9 } ],
        path: undefined },
      { message: fieldsConflictMessage(
          'fido',
          'nickname and name are different fields'
        ),
        locations: [ { line: 5, column: 9 }, { line: 4, column: 9 } ],
        path: undefined }
    ]);
  });
});
