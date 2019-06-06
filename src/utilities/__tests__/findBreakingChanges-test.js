/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { GraphQLSchema } from '../../type';

import { buildSchema } from '../buildASTSchema';

import {
  BreakingChangeType,
  DangerousChangeType,
  findBreakingChanges,
  findDangerousChanges,
} from '../findBreakingChanges';

import {
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from '../../type/directives';

describe('findBreakingChanges', () => {
  it('should detect if a type was removed or not', () => {
    const oldSchema = buildSchema(`
      type Type1
      type Type2
    `);

    const newSchema = buildSchema(`
      type Type2
    `);
    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'Type1 was removed.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').astNode,
      },
    ]);
    expect(findBreakingChanges(oldSchema, oldSchema)).to.deep.equal([]);
  });

  it('should detect if a type changed its type', () => {
    const oldSchema = buildSchema(`
      scalar TypeWasScalarBecomesEnum
      interface TypeWasInterfaceBecomesUnion
      type TypeWasObjectBecomesInputObject
    `);

    const newSchema = buildSchema(`
      enum TypeWasScalarBecomesEnum
      union TypeWasInterfaceBecomesUnion
      input TypeWasObjectBecomesInputObject
    `);
    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeWasScalarBecomesEnum changed from a Scalar type to an Enum type.',
        // $FlowFixMe
        oldNode: oldSchema.getType('TypeWasScalarBecomesEnum').astNode,
        // $FlowFixMe
        newNode: newSchema.getType('TypeWasScalarBecomesEnum').astNode,
      },
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeWasInterfaceBecomesUnion changed from an Interface type to a Union type.',
        // $FlowFixMe
        oldNode: oldSchema.getType('TypeWasInterfaceBecomesUnion').astNode,
        // $FlowFixMe
        newNode: newSchema.getType('TypeWasInterfaceBecomesUnion').astNode,
      },
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeWasObjectBecomesInputObject changed from an Object type to an Input type.',
        // $FlowFixMe
        oldNode: oldSchema.getType('TypeWasObjectBecomesInputObject').astNode,
        // $FlowFixMe
        newNode: newSchema.getType('TypeWasObjectBecomesInputObject').astNode,
      },
    ]);
  });

  it('should detect if a field on a type was deleted or changed type', () => {
    const oldSchema = buildSchema(`
      type TypeA
      type TypeB

      interface Type1 {
        field1: TypeA
        field2: String
        field3: String
        field4: TypeA
        field6: String
        field7: [String]
        field8: Int
        field9: Int!
        field10: [Int]!
        field11: Int
        field12: [Int]
        field13: [Int!]
        field14: [Int]
        field15: [[Int]]
        field16: Int!
        field17: [Int]
        field18: [[Int!]!]
      }
    `);

    const newSchema = buildSchema(`
      type TypeA
      type TypeB

      interface Type1 {
        field1: TypeA
        field3: Boolean
        field4: TypeB
        field5: String
        field6: [String]
        field7: String
        field8: Int!
        field9: Int
        field10: [Int]
        field11: [Int]!
        field12: [Int!]
        field13: [Int]
        field14: [[Int]]
        field15: [Int]
        field16: [Int]!
        field17: [Int]!
        field18: [[Int!]]
      }
    `);

    const changes = findBreakingChanges(oldSchema, newSchema);
    expect(changes).to.deep.equal([
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'Type1.field2 was removed.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field2'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field3 changed type from String to Boolean.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field3'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field3'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field4 changed type from TypeA to TypeB.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field4'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field4'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field6 changed type from String to [String].',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field6'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field6'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field7 changed type from [String] to String.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field7'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field7'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field9 changed type from Int! to Int.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field9'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field9'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field10 changed type from [Int]! to [Int].',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field10'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field10'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field11 changed type from Int to [Int]!.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field11'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field11'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field13 changed type from [Int!] to [Int].',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field13'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field13'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field14 changed type from [Int] to [[Int]].',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field14'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field14'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field15 changed type from [[Int]] to [Int].',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field15'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field15'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field16 changed type from Int! to [Int]!.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field16'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field16'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field18 changed type from [[Int!]!] to [[Int!]].',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').getFields()['field18'].astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').getFields()['field18'].astNode,
      },
    ]);
  });

  it('should detect if fields on input types changed kind or were removed', () => {
    const oldSchema = buildSchema(`
      input InputType1 {
        field1: String
        field2: Boolean
        field3: [String]
        field4: String!
        field5: String
        field6: [Int]
        field7: [Int]!
        field8: Int
        field9: [Int]
        field10: [Int!]
        field11: [Int]
        field12: [[Int]]
        field13: Int!
        field14: [[Int]!]
        field15: [[Int]!]
      }
    `);

    const newSchema = buildSchema(`
      input InputType1 {
        field1: Int
        field3: String
        field4: String
        field5: String!
        field6: [Int]!
        field7: [Int]
        field8: [Int]!
        field9: [Int!]
        field10: [Int]
        field11: [[Int]]
        field12: [Int]
        field13: [Int]!
        field14: [[Int]]
        field15: [[Int!]!]
      }
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'InputType1.field2 was removed.',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field2']
          .astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field1 changed type from String to Int.',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field1']
          .astNode,
        // $FlowFixMe
        newNode: newSchema.getTypeMap()['InputType1'].getFields()['field1']
          .astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field3 changed type from [String] to String.',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field3']
          .astNode,
        // $FlowFixMe
        newNode: newSchema.getTypeMap()['InputType1'].getFields()['field3']
          .astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field5 changed type from String to String!.',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field5']
          .astNode,
        // $FlowFixMe
        newNode: newSchema.getTypeMap()['InputType1'].getFields()['field5']
          .astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field6 changed type from [Int] to [Int]!.',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field6']
          .astNode,
        // $FlowFixMe
        newNode: newSchema.getTypeMap()['InputType1'].getFields()['field6']
          .astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field8 changed type from Int to [Int]!.',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field8']
          .astNode,
        // $FlowFixMe
        newNode: newSchema.getTypeMap()['InputType1'].getFields()['field8']
          .astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field9 changed type from [Int] to [Int!].',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field9']
          .astNode,
        // $FlowFixMe
        newNode: newSchema.getTypeMap()['InputType1'].getFields()['field9']
          .astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field11 changed type from [Int] to [[Int]].',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field11']
          .astNode,
        // $FlowFixMe
        newNode: newSchema.getTypeMap()['InputType1'].getFields()['field11']
          .astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field12 changed type from [[Int]] to [Int].',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field12']
          .astNode,
        // $FlowFixMe
        newNode: newSchema.getTypeMap()['InputType1'].getFields()['field12']
          .astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field13 changed type from Int! to [Int]!.',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field13']
          .astNode,
        // $FlowFixMe
        newNode: newSchema.getTypeMap()['InputType1'].getFields()['field13']
          .astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description:
          'InputType1.field15 changed type from [[Int]!] to [[Int!]!].',
        // $FlowFixMe
        oldNode: oldSchema.getTypeMap()['InputType1'].getFields()['field15']
          .astNode,
        // $FlowFixMe
        newNode: newSchema.getTypeMap()['InputType1'].getFields()['field15']
          .astNode,
      },
    ]);
  });

  it('should detect if a required field is added to an input type', () => {
    const oldSchema = buildSchema(`
      input InputType1 {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      input InputType1 {
        field1: String
        requiredField: Int!
        optionalField1: Boolean
        optionalField2: Boolean! = false
      }
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
        description:
          'A required field requiredField on input type InputType1 was added.',
        // $FlowFixMe
        newNode: newSchema.getType('InputType1').getFields()['requiredField']
          .astNode,
      },
    ]);
  });

  it('should detect if a type was removed from a union type', () => {
    const oldSchema = buildSchema(`
      type Type1
      type Type2
      type Type3

      union UnionType1 = Type1 | Type2
    `);
    const newSchema = buildSchema(`
      type Type1
      type Type2
      type Type3

      union UnionType1 = Type1 | Type3
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
        description: 'Type2 was removed from union type UnionType1.',
        oldNode: oldSchema.getTypeMap()['UnionType1'].astNode,
        newNode: newSchema.getTypeMap()['UnionType1'].astNode,
      },
    ]);
  });

  it('should detect if a value was removed from an enum type', () => {
    const oldSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE1
        VALUE2
      }
    `);

    const newSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE2
        VALUE3
      }
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
        description: 'VALUE1 was removed from enum type EnumType1.',
        // $FlowFixMe
        oldNode: oldSchema.getType('EnumType1').getValue('VALUE1').astNode,
      },
    ]);
  });

  it('should detect if a field argument was removed', () => {
    const oldSchema = buildSchema(`
      interface Interface1 {
        field1(arg1: Boolean, objectArg: String): String
      }

      type Type1 {
        field1(name: String): String
      }
    `);

    const newSchema = buildSchema(`
      interface Interface1 {
        field1: String
      }

      type Type1 {
        field1: String
      }
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Interface1.field1 arg arg1 was removed.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Interface1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg1').astNode,
      },
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Interface1.field1 arg objectArg was removed.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Interface1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'objectArg').astNode,
      },
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Type1.field1 arg name was removed.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'name').astNode,
      },
    ]);
  });

  it('should detect if a field argument has changed type', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1(
          arg1: String
          arg2: String
          arg3: [String]
          arg4: String
          arg5: String!
          arg6: String!
          arg7: [Int]!
          arg8: Int
          arg9: [Int]
          arg10: [Int!]
          arg11: [Int]
          arg12: [[Int]]
          arg13: Int!
          arg14: [[Int]!]
          arg15: [[Int]!]
        ): String
      }
    `);

    const newSchema = buildSchema(`
      type Type1 {
        field1(
          arg1: Int
          arg2: [String]
          arg3: String
          arg4: String!
          arg5: Int
          arg6: Int!
          arg7: [Int]
          arg8: [Int]!
          arg9: [Int!]
          arg10: [Int]
          arg11: [[Int]]
          arg12: [Int]
          arg13: [Int]!
          arg14: [[Int]]
          arg15: [[Int!]!]
         ): String
      }
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg1 has changed type from String to Int.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg1').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg1').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg2 has changed type from String to [String].',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg2').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg2').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg3 has changed type from [String] to String.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg3').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg3').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg4 has changed type from String to String!.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg4').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg4').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg5 has changed type from String! to Int.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg5').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg5').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg6 has changed type from String! to Int!.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg6').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg6').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg8 has changed type from Int to [Int]!.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg8').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg8').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg9 has changed type from [Int] to [Int!].',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg9').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg9').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg11 has changed type from [Int] to [[Int]].',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg11').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg11').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg12 has changed type from [[Int]] to [Int].',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg12').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg12').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg13 has changed type from Int! to [Int]!.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg13').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg13').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg15 has changed type from [[Int]!] to [[Int!]!].',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg15').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg15').astNode,
      },
    ]);
  });

  it('should detect if a required field argument was added', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1(arg1: String): String
      }
    `);

    const newSchema = buildSchema(`
      type Type1 {
        field1(
          arg1: String,
          newRequiredArg: String!
          newOptionalArg1: Int
          newOptionalArg2: Int! = 0
        ): String
      }
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.REQUIRED_ARG_ADDED,
        description: 'A required arg newRequiredArg on Type1.field1 was added.',
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'newRequiredArg').astNode,
      },
    ]);
  });

  it('should not flag args with the same type signature as breaking', () => {
    const oldSchema = buildSchema(`
      input InputType1 {
        field1: String
      }

      type Type1 {
        field1(arg1: Int!, arg2: InputType1): Int
      }
    `);

    const newSchema = buildSchema(`
      input InputType1 {
        field1: String
      }

      type Type1 {
        field1(arg1: Int!, arg2: InputType1): Int
      }
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([]);
  });

  it('should consider args that move away from NonNull as non-breaking', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1(name: String!): String
      }
    `);

    const newSchema = buildSchema(`
      type Type1 {
        field1(name: String): String
      }
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([]);
  });

  // TODO: implement test changes
  it('should detect interfaces removed from types', () => {
    const oldSchema = buildSchema(`
      interface Interface1

      type Type1 implements Interface1
    `);

    const newSchema = buildSchema(`
      interface Interface1

      type Type1
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
        description: 'Type1 no longer implements interface Interface1.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').astNode,
      },
    ]);
  });

  it('should ignore changes in order of interfaces', () => {
    const oldSchema = buildSchema(`
      interface FirstInterface
      interface SecondInterface

      type Type1 implements FirstInterface & SecondInterface
    `);

    const newSchema = buildSchema(`
      interface FirstInterface
      interface SecondInterface

      type Type1 implements SecondInterface & FirstInterface
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([]);
  });

  it('should detect all breaking changes', () => {
    const oldSchema = buildSchema(`
      directive @DirectiveThatIsRemoved on FIELD_DEFINITION

      directive @DirectiveThatRemovesArg(arg1: String) on FIELD_DEFINITION

      directive @NonNullDirectiveAdded on FIELD_DEFINITION

      directive @DirectiveName on FIELD_DEFINITION | QUERY

      type ArgThatChanges {
        field1(id: Int): String
      }

      enum EnumTypeThatLosesAValue {
        VALUE0
        VALUE1
        VALUE2
      }

      interface Interface1
      type TypeThatLooseInterface1 implements Interface1

      type TypeInUnion1
      type TypeInUnion2
      union UnionTypeThatLosesAType = TypeInUnion1 | TypeInUnion2

      type TypeThatChangesType

      type TypeThatGetsRemoved

      interface TypeThatHasBreakingFieldChanges {
        field1: String
        field2: String
      }
    `);

    const newSchema = buildSchema(`
      directive @DirectiveThatRemovesArg on FIELD_DEFINITION

      directive @NonNullDirectiveAdded(arg1: Boolean!) on FIELD_DEFINITION

      directive @DirectiveName on FIELD_DEFINITION

      type ArgThatChanges {
        field1(id: String): String
      }

      enum EnumTypeThatLosesAValue {
        VALUE1
        VALUE2
      }

      interface Interface1
      type TypeThatLooseInterface1

      type TypeInUnion1
      type TypeInUnion2
      union UnionTypeThatLosesAType = TypeInUnion1

      interface TypeThatChangesType

      interface TypeThatHasBreakingFieldChanges {
        field2: Boolean
      }
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'Int was removed.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Int').astNode,
      },
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'TypeThatGetsRemoved was removed.',
        // $FlowFixMe
        oldNode: oldSchema.getType('TypeThatGetsRemoved').astNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'ArgThatChanges.field1 arg id has changed type from Int to String.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('ArgThatChanges')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'id').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('ArgThatChanges')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'id').astNode,
      },
      {
        type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
        description:
          'VALUE0 was removed from enum type EnumTypeThatLosesAValue.',
        // $FlowFixMe
        oldNode: oldSchema.getType('EnumTypeThatLosesAValue').getValue('VALUE0')
          .astNode,
      },
      {
        type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
        description:
          'TypeThatLooseInterface1 no longer implements interface Interface1.',
        // $FlowFixMe
        oldNode: oldSchema.getType('TypeThatLooseInterface1').astNode,
        // $FlowFixMe
        newNode: newSchema.getType('TypeThatLooseInterface1').astNode,
      },
      {
        type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
        description:
          'TypeInUnion2 was removed from union type UnionTypeThatLosesAType.',
        oldNode: oldSchema.getTypeMap()['UnionTypeThatLosesAType'].astNode,
        newNode: newSchema.getTypeMap()['UnionTypeThatLosesAType'].astNode,
      },
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeThatChangesType changed from an Object type to an Interface type.',
        // $FlowFixMe
        oldNode: oldSchema.getType('TypeThatChangesType').astNode,
        // $FlowFixMe
        newNode: newSchema.getType('TypeThatChangesType').astNode,
      },
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'TypeThatHasBreakingFieldChanges.field1 was removed.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('TypeThatHasBreakingFieldChanges')
          .getFields()['field1'].astNode,
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description:
          'TypeThatHasBreakingFieldChanges.field2 changed type from String to Boolean.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('TypeThatHasBreakingFieldChanges')
          .getFields()['field2'].astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('TypeThatHasBreakingFieldChanges')
          .getFields()['field2'].astNode,
      },
      {
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: 'DirectiveThatIsRemoved was removed.',
        // $FlowFixMe
        oldNode: oldSchema.getDirective('DirectiveThatIsRemoved').astNode,
      },
      {
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: 'arg1 was removed from DirectiveThatRemovesArg.',
        // $FlowFixMe
        oldNode: oldSchema
          .getDirective('DirectiveThatRemovesArg')
          .args.find(arg => arg.name === 'arg1').astNode,
      },
      {
        type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
        description:
          'A required arg arg1 on directive NonNullDirectiveAdded was added.',
        // $FlowFixMe
        newNode: newSchema
          .getDirective('NonNullDirectiveAdded')
          .args.find(arg => arg.name === 'arg1').astNode,
      },
      {
        type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
        description: 'QUERY was removed from DirectiveName.',
        // $FlowFixMe
        oldNode: oldSchema.getDirective('DirectiveName').astNode,
      },
    ]);
  });

  it('should detect if a directive was explicitly removed', () => {
    const oldSchema = buildSchema(`
      directive @DirectiveThatIsRemoved on FIELD_DEFINITION
      directive @DirectiveThatStays on FIELD_DEFINITION
    `);

    const newSchema = buildSchema(`
      directive @DirectiveThatStays on FIELD_DEFINITION
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: 'DirectiveThatIsRemoved was removed.',
        // $FlowFixMe
        oldNode: oldSchema.getDirective('DirectiveThatIsRemoved').astNode,
      },
    ]);
  });

  it('should detect if a directive was implicitly removed', () => {
    const oldSchema = new GraphQLSchema({});

    const newSchema = new GraphQLSchema({
      directives: [GraphQLSkipDirective, GraphQLIncludeDirective],
    });

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: `${GraphQLDeprecatedDirective.name} was removed.`,
        oldNode: undefined,
      },
    ]);
  });

  it('should detect if a directive argument was removed', () => {
    const oldSchema = buildSchema(`
      directive @DirectiveWithArg(arg1: String) on FIELD_DEFINITION
    `);

    const newSchema = buildSchema(`
      directive @DirectiveWithArg on FIELD_DEFINITION
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: 'arg1 was removed from DirectiveWithArg.',
        // $FlowFixMe
        oldNode: oldSchema
          .getDirective('DirectiveWithArg')
          .args.find(arg => arg.name === 'arg1').astNode,
      },
    ]);
  });

  it('should detect if an required directive argument was added', () => {
    const oldSchema = buildSchema(`
      directive @DirectiveName on FIELD_DEFINITION
    `);

    const newSchema = buildSchema(`
      directive @DirectiveName(
        newRequiredArg: String!
        newOptionalArg1: Int
        newOptionalArg2: Int! = 0
      ) on FIELD_DEFINITION
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
        description:
          'A required arg newRequiredArg on directive DirectiveName was added.',
        // $FlowFixMe
        newNode: newSchema
          .getDirective('DirectiveName')
          .args.find(arg => arg.name === 'newRequiredArg').astNode,
      },
    ]);
  });

  it('should detect locations removed from a directive', () => {
    const oldSchema = buildSchema(`
      directive @DirectiveName on FIELD_DEFINITION | QUERY
    `);

    const newSchema = buildSchema(`
      directive @DirectiveName on FIELD_DEFINITION
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
        description: 'QUERY was removed from DirectiveName.',
        // $FlowFixMe
        oldNode: oldSchema.getDirective('DirectiveName').astNode,
      },
    ]);
  });
});

describe('findDangerousChanges', () => {
  it('should detect if a defaultValue changed on an argument', () => {
    const oldSDL = `
      input Input1 {
        innerInputArray: [Input2]
      }

      input Input2 {
        arrayField: [Int]
      }

      type Type1 {
        field1(
          withDefaultValue: String = "TO BE DELETED"
          stringArg: String = "test"
          emptyArray: [Int!] = []
          valueArray: [[String]] = [["a", "b"], ["c"]]
          complexObject: Input1 = {
            innerInputArray: [{ arrayField: [1, 2, 3] }]
          }
        ): String
      }
    `;

    const oldSchema = buildSchema(oldSDL);
    const copyOfOldSchema = buildSchema(oldSDL);
    expect(findDangerousChanges(oldSchema, copyOfOldSchema)).to.deep.equal([]);

    const newSchema = buildSchema(`
      input Input1 {
        innerInputArray: [Input2]
      }

      input Input2 {
        arrayField: [Int]
      }

      type Type1 {
        field1(
          withDefaultValue: String
          stringArg: String = "Test"
          emptyArray: [Int!] = [7]
          valueArray: [[String]] = [["b", "a"], ["d"]]
          complexObject: Input1 = {
            innerInputArray: [{ arrayField: [3, 2, 1] }]
          }
        ): String
      }
    `);

    expect(findDangerousChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg withDefaultValue defaultValue was removed.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'withDefaultValue').astNode,
        newNode: undefined,
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg stringArg has changed defaultValue from "test" to "Test".',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'stringArg').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'stringArg').astNode,
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg emptyArray has changed defaultValue from [] to [7].',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'emptyArray').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'emptyArray').astNode,
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg valueArray has changed defaultValue from [["a", "b"], ["c"]] to [["b", "a"], ["d"]].',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'valueArray').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'valueArray').astNode,
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg complexObject has changed defaultValue from {innerInputArray: [{arrayField: [1, 2, 3]}]} to {innerInputArray: [{arrayField: [3, 2, 1]}]}.',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'complexObject').astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'complexObject').astNode,
      },
    ]);
  });

  it('should ignore changes in field order of defaultValue', () => {
    const oldSchema = buildSchema(`
      input Input1 {
        a: String
        b: String
        c: String
      }

      type Type1 {
        field1(
          arg1: Input1 = { a: "a", b: "b", c: "c" }
        ): String
      }
    `);

    const newSchema = buildSchema(`
      input Input1 {
        a: String
        b: String
        c: String
      }

      type Type1 {
        field1(
          arg1: Input1 = { c: "c", b: "b", a: "a" }
        ): String
      }
    `);

    expect(findDangerousChanges(oldSchema, newSchema)).to.deep.equal([]);
  });

  it('should detect if a value was added to an enum type', () => {
    const oldSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE1
      }
    `);

    const newSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE1
        VALUE2
      }
    `);

    expect(findDangerousChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
        description: 'VALUE2 was added to enum type EnumType1.',
        // $FlowFixMe
        newNode: newSchema.getType('EnumType1').getValue('VALUE2').astNode,
      },
    ]);
  });

  it('should detect interfaces added to types', () => {
    const oldSchema = buildSchema(`
      interface OldInterface
      interface NewInterface

      type Type1 implements OldInterface
    `);

    const newSchema = buildSchema(`
      interface OldInterface
      interface NewInterface

      type Type1 implements OldInterface & NewInterface
    `);

    expect(findDangerousChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
        description: 'NewInterface added to interfaces implemented by Type1.',
        // $FlowFixMe
        oldNode: oldSchema.getType('Type1').astNode,
        // $FlowFixMe
        newNode: newSchema.getType('Type1').astNode,
      },
    ]);
  });

  it('should detect if a type was added to a union type', () => {
    const oldSchema = buildSchema(`
      type Type1
      type Type2

      union UnionType1 = Type1
    `);

    const newSchema = buildSchema(`
      type Type1
      type Type2

      union UnionType1 = Type1 | Type2
    `);

    expect(findDangerousChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: DangerousChangeType.TYPE_ADDED_TO_UNION,
        description: 'Type2 was added to union type UnionType1.',
        // $FlowFixMe
        oldNode: oldSchema.getType('UnionType1').astNode,
        // $FlowFixMe
        newNode: newSchema.getType('UnionType1').astNode,
      },
    ]);
  });

  it('should detect if an optional field was added to an input', () => {
    const oldSchema = buildSchema(`
      input InputType1 {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      input InputType1 {
        field1: String
        field2: Int
      }
    `);

    expect(findDangerousChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
        description:
          'An optional field field2 on input type InputType1 was added.',
        // $FlowFixMe
        newNode: newSchema.getType('InputType1').getFields()['field2'].astNode,
      },
    ]);
  });

  it('should find all dangerous changes', () => {
    const oldSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE1
      }

      type Type1 {
        field1(argThatChangesDefaultValue: String = "test"): String
      }

      interface Interface1
      type TypeThatGainsInterface1

      type TypeInUnion1
      union UnionTypeThatGainsAType = TypeInUnion1
    `);

    const newSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE1
        VALUE2
      }

      type Type1 {
        field1(argThatChangesDefaultValue: String = "Test"): String
      }

      interface Interface1
      type TypeThatGainsInterface1 implements Interface1

      type TypeInUnion1
      type TypeInUnion2
      union UnionTypeThatGainsAType = TypeInUnion1 | TypeInUnion2
    `);

    expect(findDangerousChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
        description: 'VALUE2 was added to enum type EnumType1.',
        // $FlowFixMe
        newNode: newSchema.getType('EnumType1').getValue('VALUE2').astNode,
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg argThatChangesDefaultValue has changed defaultValue from "test" to "Test".',
        // $FlowFixMe
        oldNode: oldSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'argThatChangesDefaultValue')
          .astNode,
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'argThatChangesDefaultValue')
          .astNode,
      },
      {
        type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
        description:
          'Interface1 added to interfaces implemented by TypeThatGainsInterface1.',
        // $FlowFixMe
        oldNode: oldSchema.getType('TypeThatGainsInterface1').astNode,
        // $FlowFixMe
        newNode: newSchema.getType('TypeThatGainsInterface1').astNode,
      },
      {
        type: DangerousChangeType.TYPE_ADDED_TO_UNION,
        description:
          'TypeInUnion2 was added to union type UnionTypeThatGainsAType.',
        // $FlowFixMe
        oldNode: oldSchema.getType('UnionTypeThatGainsAType').astNode,
        // $FlowFixMe
        newNode: newSchema.getType('UnionTypeThatGainsAType').astNode,
      },
    ]);
  });

  it('should detect if an optional field argument was added', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1(arg1: String): String
      }
    `);

    const newSchema = buildSchema(`
      type Type1 {
        field1(arg1: String, arg2: String): String
      }
    `);

    expect(findDangerousChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: DangerousChangeType.OPTIONAL_ARG_ADDED,
        description: 'An optional arg arg2 on Type1.field1 was added.',
        // $FlowFixMe
        newNode: newSchema
          .getType('Type1')
          .getFields()
          ['field1'].args.find(arg => arg.name === 'arg2').astNode,
      },
    ]);
  });
});
