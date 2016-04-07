/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

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
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] },
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
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] },
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
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] }
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
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] }
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
        locations: [ { line: 3, column: 9 }, { line: 4, column: 9 } ] }
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
        locations: [ { line: 7, column: 9 }, { line: 10, column: 9 } ] }
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
        locations: [ { line: 18, column: 9 }, { line: 21, column: 9 } ] },
      { message: fieldsConflictMessage('x', 'a and c are different fields'),
        locations: [ { line: 18, column: 9 }, { line: 14, column: 11 } ] },
      { message: fieldsConflictMessage('x', 'b and c are different fields'),
        locations: [ { line: 21, column: 9 }, { line: 14, column: 11 } ] }
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
          { line: 7, column: 11 } ] },
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
          { line: 9, column: 11 } ] },
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
          { line: 10, column: 13 } ] },
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
          { line: 8, column: 13 } ] },
    ]);
  });

  describe('return types must be unambiguous', () => {

    const SomeBox = new GraphQLInterfaceType({
      name: 'SomeBox',
      resolveType: () => StringBox,
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
      resolveType: () => StringBox,
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
      resolveType: () => StringBox,
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
          locations: [ { line: 5, column: 15 }, { line: 8, column: 15 } ] }
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
          locations: [ { line: 5, column: 15 }, { line: 8, column: 15 } ] }
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
          locations: [ { line: 5, column: 15 }, { line: 8, column: 15 } ] }
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
          locations: [ { line: 5, column: 15 }, { line: 10, column: 15 } ] }
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
          locations: [ { line: 5, column: 15 }, { line: 10, column: 15 } ] }
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
          locations: [ { line: 6, column: 17 }, { line: 7, column: 17 } ] }
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
            { line: 11, column: 17 } ] }
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
            [ [ 'node', [ [ 'id', 'id and name are different fields' ] ] ] ]
          ),
          locations: [
            { line: 14, column: 11 },
            { line: 15, column: 13 },
            { line: 16, column: 15 },
            { line: 5, column: 13 },
            { line: 6, column: 15 },
            { line: 7, column: 17 },
          ] }
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

  });

});
