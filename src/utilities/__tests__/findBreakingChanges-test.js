/**
 * Copyright (c) 2016-present, Facebook, Inc.
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
  findFieldsThatChangedTypeOnObjectOrInterfaceTypes,
  findFieldsThatChangedTypeOnInputObjectTypes,
  findRemovedTypes,
  findTypesRemovedFromUnions,
  findTypesAddedToUnions,
  findTypesThatChangedKind,
  findValuesRemovedFromEnums,
  findValuesAddedToEnums,
  findArgChanges,
  findInterfacesRemovedFromObjectTypes,
  findInterfacesAddedToObjectTypes,
  findRemovedDirectives,
  findRemovedDirectiveArgs,
  findAddedNonNullDirectiveArgs,
  findRemovedLocationsForDirective,
  findRemovedDirectiveLocations,
  findRemovedDirectiveRepeatable,
} from '../findBreakingChanges';

import {
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
  GraphQLDirective,
} from '../../type/directives';

import { DirectiveLocation } from '../../language/directiveLocation';

describe('findBreakingChanges', () => {
  it('should detect if a type was removed or not', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1: String
      }

      type Type2 {
        field1: String
      }

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      type Type2 {
        field1: String
      }

      type Query {
        field1: String
      }
    `);
    expect(findRemovedTypes(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'Type1 was removed.',
      },
    ]);
    expect(findRemovedTypes(oldSchema, oldSchema)).to.eql([]);
  });

  it('should detect if a type changed its type', () => {
    const oldSchema = buildSchema(`
      interface Type1 {
        field1: String
      }

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      type ObjectType {
        field1: String
      }

      union Type1 = ObjectType

      type Query {
        field1: String
      }
    `);
    expect(findTypesThatChangedKind(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description: 'Type1 changed from an Interface type to a Union type.',
      },
    ]);
  });

  it('should detect if a field on a type was deleted or changed type', () => {
    const oldSchema = buildSchema(`
      type TypeA {
        field1: String
      }

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

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      type TypeA {
        field1: String
      }

      type TypeB {
        field1: String
      }

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

      type Query {
        field1: String
      }
    `);

    const expectedFieldChanges = [
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'Type1.field2 was removed.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field3 changed type from String to Boolean.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field4 changed type from TypeA to TypeB.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field6 changed type from String to [String].',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field7 changed type from [String] to String.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field9 changed type from Int! to Int.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field10 changed type from [Int]! to [Int].',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field11 changed type from Int to [Int]!.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field13 changed type from [Int!] to [Int].',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field14 changed type from [Int] to [[Int]].',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field15 changed type from [[Int]] to [Int].',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field16 changed type from Int! to [Int]!.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field18 changed type from [[Int!]!] to [[Int!]].',
      },
    ];
    expect(
      findFieldsThatChangedTypeOnObjectOrInterfaceTypes(oldSchema, newSchema),
    ).to.eql(expectedFieldChanges);
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

      type Query {
        field1: String
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

      type Query {
        field1: String
      }
    `);

    const expectedFieldChanges = [
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field1 changed type from String to Int.',
      },
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'InputType1.field2 was removed.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field3 changed type from [String] to String.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field5 changed type from String to String!.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field6 changed type from [Int] to [Int]!.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field8 changed type from Int to [Int]!.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field9 changed type from [Int] to [Int!].',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field11 changed type from [Int] to [[Int]].',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field12 changed type from [[Int]] to [Int].',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field13 changed type from Int! to [Int]!.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description:
          'InputType1.field15 changed type from [[Int]!] to [[Int!]!].',
      },
    ];
    expect(
      findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema)
        .breakingChanges,
    ).to.eql(expectedFieldChanges);
  });

  it('should detect if a required field is added to an input type', () => {
    const oldSchema = buildSchema(`
      input InputType1 {
        field1: String
      }

      type Query {
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

      type Query {
        field1: String
      }
    `);

    const expectedFieldChanges = [
      {
        type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
        description:
          'A required field requiredField on input type InputType1 was added.',
      },
    ];
    expect(
      findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema)
        .breakingChanges,
    ).to.eql(expectedFieldChanges);
  });

  it('should detect if a type was removed from a union type', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1: String
      }

      type Type2 {
        field1: String
      }

      union UnionType1 = Type1 | Type2

      type Query {
        field1: String
      }
    `);
    const newSchema = buildSchema(`
      type Type1 {
        field1: String
      }

      type Type3 {
        field1: String
      }

      union UnionType1 = Type1 | Type3

      type Query {
        field1: String
      }
    `);

    expect(findTypesRemovedFromUnions(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
        description: 'Type2 was removed from union type UnionType1.',
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

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE2
        VALUE3
      }

      type Query {
        field1: String
      }
    `);

    expect(findValuesRemovedFromEnums(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
        description: 'VALUE1 was removed from enum type EnumType1.',
      },
    ]);
  });

  it('should detect if a field argument was removed', () => {
    const oldSchema = buildSchema(`
      input InputType1 {
        field1: String
      }

      interface Interface1 {
        field1(arg1: Boolean, objectArg: InputType1): String
      }

      type Type1 {
        field1(name: String): String
      }

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      interface Interface1 {
        field1: String
      }

      type Type1 {
        field1: String
      }

      type Query {
        field1: String
      }
    `);

    expect(findArgChanges(oldSchema, newSchema).breakingChanges).to.eql([
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Interface1.field1 arg arg1 was removed',
      },
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Interface1.field1 arg objectArg was removed',
      },
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Type1.field1 arg name was removed',
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

      type Query {
        field1: String
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

      type Query {
        field1: String
      }
    `);

    expect(findArgChanges(oldSchema, newSchema).breakingChanges).to.eql([
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg1 has changed type from String to Int',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg2 has changed type from String to [String]',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg3 has changed type from [String] to String',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg4 has changed type from String to String!',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg5 has changed type from String! to Int',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg6 has changed type from String! to Int!',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg8 has changed type from Int to [Int]!',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg9 has changed type from [Int] to [Int!]',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg11 has changed type from [Int] to [[Int]]',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg12 has changed type from [[Int]] to [Int]',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg13 has changed type from Int! to [Int]!',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg15 has changed type from [[Int]!] to [[Int!]!]',
      },
    ]);
  });

  it('should detect if a required field argument was added', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1(arg1: String): String
      }

      type Query {
        field1: String
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

      type Query {
        field1: String
      }
    `);

    expect(findArgChanges(oldSchema, newSchema).breakingChanges).to.eql([
      {
        type: BreakingChangeType.REQUIRED_ARG_ADDED,
        description: 'A required arg newRequiredArg on Type1.field1 was added',
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

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      input InputType1 {
        field1: String
      }

      type Type1 {
        field1(arg1: Int!, arg2: InputType1): Int
      }

      type Query {
        field1: String
      }
    `);

    expect(findArgChanges(oldSchema, newSchema).breakingChanges).to.eql([]);
  });

  it('should consider args that move away from NonNull as non-breaking', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1(name: String!): String
      }

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      type Type1 {
        field1(name: String): String
      }

      type Query {
        field1: String
      }
    `);

    expect(findArgChanges(oldSchema, newSchema).breakingChanges).to.eql([]);
  });

  it('should detect interfaces removed from types', () => {
    const oldSchema = buildSchema(`
      interface Interface1 {
        field1: String
      }

      type Type1 implements Interface1 {
        field1: String
      }

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      type Type1 {
        field1: String
      }

      type Query {
        field1: String
      }
    `);

    expect(findInterfacesRemovedFromObjectTypes(oldSchema, newSchema)).to.eql([
      {
        description: 'Type1 no longer implements interface Interface1.',
        type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
      },
    ]);
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

      interface Interface1 {
        field1: String
      }

      type TypeThatGainsInterface1 implements Interface1 {
        field1: String
      }

      type TypeInUnion1 {
        field1: String
      }

      type TypeInUnion2 {
        field1: String
      }

      union UnionTypeThatLosesAType = TypeInUnion1 | TypeInUnion2

      type TypeThatChangesType {
        field1: String
      }

      type TypeThatGetsRemoved {
        field1: String
      }

      interface TypeThatHasBreakingFieldChanges {
        field1: String
        field2: String
      }

      type Query {
        field1: String
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

      interface Interface1 {
        field1: String
      }

      type TypeInUnion1 {
        field1: String
      }

      union UnionTypeThatLosesAType = TypeInUnion1

      interface TypeThatChangesType {
        field1: String
      }

      type TypeThatGainsInterface1 {
        field1: String
      }

      interface TypeThatHasBreakingFieldChanges {
        field2: Boolean
      }

      type Query {
        field1: String
      }
    `);

    const expectedBreakingChanges = [
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'Int was removed.',
      },
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'TypeInUnion2 was removed.',
      },
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'TypeThatGetsRemoved was removed.',
      },
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeThatChangesType changed from an Object type to an Interface type.',
      },
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'TypeThatHasBreakingFieldChanges.field1 was removed.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description:
          'TypeThatHasBreakingFieldChanges.field2 changed type from String to Boolean.',
      },
      {
        type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
        description:
          'TypeInUnion2 was removed from union type UnionTypeThatLosesAType.',
      },
      {
        type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
        description:
          'VALUE0 was removed from enum type EnumTypeThatLosesAValue.',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'ArgThatChanges.field1 arg id has changed type from Int to String',
      },
      {
        type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
        description:
          'TypeThatGainsInterface1 no longer implements interface Interface1.',
      },
      {
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: 'DirectiveThatIsRemoved was removed',
      },
      {
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: 'arg1 was removed from DirectiveThatRemovesArg',
      },
      {
        type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
        description:
          'A required arg arg1 on directive NonNullDirectiveAdded was added',
      },
      {
        type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
        description: 'QUERY was removed from DirectiveName',
      },
    ];
    expect(findBreakingChanges(oldSchema, newSchema)).to.eql(
      expectedBreakingChanges,
    );
  });

  it('should detect if a directive was explicitly removed', () => {
    const oldSchema = buildSchema(`
      directive @DirectiveThatIsRemoved on FIELD_DEFINITION
      directive @DirectiveThatStays on FIELD_DEFINITION
    `);

    const newSchema = buildSchema(`
      directive @DirectiveThatStays on FIELD_DEFINITION
    `);

    expect(findRemovedDirectives(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: `DirectiveThatIsRemoved was removed`,
      },
    ]);
  });

  it('should detect if a directive was implicitly removed', () => {
    const oldSchema = new GraphQLSchema({});

    const newSchema = new GraphQLSchema({
      directives: [GraphQLSkipDirective, GraphQLIncludeDirective],
    });

    expect(findRemovedDirectives(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: `${GraphQLDeprecatedDirective.name} was removed`,
      },
    ]);
  });

  it('should detect if a directive argument was removed', () => {
    const oldSchema = buildSchema(`
      directive @DirectiveWithArg(arg1: Int) on FIELD_DEFINITION
    `);

    const newSchema = buildSchema(`
      directive @DirectiveWithArg on FIELD_DEFINITION
    `);

    expect(findRemovedDirectiveArgs(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: 'arg1 was removed from DirectiveWithArg',
      },
    ]);
  });

  it('should detect if an optional directive argument was added', () => {
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

    expect(findAddedNonNullDirectiveArgs(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
        description:
          'A required arg newRequiredArg on directive DirectiveName was added',
      },
    ]);
  });

  it('should detect locations removed from a directive', () => {
    const d1 = new GraphQLDirective({
      name: 'Directive Name',
      locations: [DirectiveLocation.FIELD_DEFINITION, DirectiveLocation.QUERY],
    });

    const d2 = new GraphQLDirective({
      name: 'Directive Name',
      locations: [DirectiveLocation.FIELD_DEFINITION],
    });

    expect(findRemovedLocationsForDirective(d1, d2)).to.eql([
      DirectiveLocation.QUERY,
    ]);
  });

  it('should detect locations removed directives within a schema', () => {
    const oldSchema = buildSchema(`
      directive @DirectiveName on FIELD_DEFINITION | QUERY
    `);

    const newSchema = buildSchema(`
      directive @DirectiveName on FIELD_DEFINITION
    `);

    expect(findRemovedDirectiveLocations(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
        description: 'QUERY was removed from DirectiveName',
      },
    ]);
  });

  it('should detect removal of repeatable flag', () => {
    const oldSchema = buildSchema(`
      directive @foo repeatable on OBJECT
    `);

    const newSchema = buildSchema(`
      directive @foo on OBJECT
    `);

    expect(findRemovedDirectiveRepeatable(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.DIRECTIVE_REPEATABLE_REMOVED,
        description: 'Repeatable flag was removed from foo',
      },
    ]);
  });
});

describe('findDangerousChanges', () => {
  describe('findArgChanges', () => {
    it("should detect if an argument's defaultValue has changed", () => {
      const oldSchema = buildSchema(`
        type Type1 {
          field1(name: String = "test"): String
        }

        type Query {
          field1: String
        }
      `);

      const newSchema = buildSchema(`
        type Type1 {
          field1(name: String = "Test"): String
        }

        type Query {
          field1: String
        }
      `);

      expect(findArgChanges(oldSchema, newSchema).dangerousChanges).to.eql([
        {
          type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
          description: 'Type1.field1 arg name has changed defaultValue',
        },
      ]);
    });
  });

  it('should detect if a value was added to an enum type', () => {
    const oldSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE1
      }

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE1
        VALUE2
      }

      type Query {
        field1: String
      }
    `);

    expect(findValuesAddedToEnums(oldSchema, newSchema)).to.eql([
      {
        type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
        description: 'VALUE2 was added to enum type EnumType1.',
      },
    ]);
  });

  it('should detect interfaces added to types', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1: String
      }

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      interface Interface1 {
        field1: String
      }

      type Type1 implements Interface1 {
        field1: String
      }

      type Query {
        field1: String
      }
    `);

    expect(findInterfacesAddedToObjectTypes(oldSchema, newSchema)).to.eql([
      {
        description: 'Interface1 added to interfaces implemented by Type1.',
        type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
      },
    ]);
  });

  it('should detect if a type was added to a union type', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1: String
      }

      union UnionType1 = Type1

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      type Type1 {
        field1: String
      }

      type Type2 {
        field1: String
      }

      union UnionType1 = Type1 | Type2

      type Query {
        field1: String
      }
    `);

    expect(findTypesAddedToUnions(oldSchema, newSchema)).to.eql([
      {
        type: DangerousChangeType.TYPE_ADDED_TO_UNION,
        description: 'Type2 was added to union type UnionType1.',
      },
    ]);
  });

  it('should detect if an optional field was added to an input', () => {
    const oldSchema = buildSchema(`
      input InputType1 {
        field1: String
      }

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      input InputType1 {
        field1: String
        field2: Int
      }

      type Query {
        field1: String
      }
    `);

    const expectedFieldChanges = [
      {
        type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
        description:
          'An optional field field2 on input type InputType1 was added.',
      },
    ];

    expect(
      findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema)
        .dangerousChanges,
    ).to.eql(expectedFieldChanges);
  });

  it('should find all dangerous changes', () => {
    const oldSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE1
      }

      type Type1 {
        field1(name: String = "test"): String
      }

      type TypeThatGainsInterface1 {
        field1: String
      }

      type TypeInUnion1 {
        field1: String
      }

      union UnionTypeThatGainsAType = TypeInUnion1

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      enum EnumType1 {
        VALUE0
        VALUE1
        VALUE2
      }

      interface Interface1 {
        field1: String
      }

      type TypeThatGainsInterface1 implements Interface1 {
        field1: String
      }

      type Type1 {
        field1(name: String = "Test"): String
      }

      type TypeInUnion1 {
        field1: String
      }

      type TypeInUnion2 {
        field1: String
      }

      union UnionTypeThatGainsAType = TypeInUnion1 | TypeInUnion2

      type Query {
        field1: String
      }
    `);

    const expectedDangerousChanges = [
      {
        description: 'Type1.field1 arg name has changed defaultValue',
        type: 'ARG_DEFAULT_VALUE_CHANGE',
      },
      {
        description: 'VALUE2 was added to enum type EnumType1.',
        type: 'VALUE_ADDED_TO_ENUM',
      },
      {
        description:
          'Interface1 added to interfaces implemented by TypeThatGainsInterface1.',
        type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
      },
      {
        type: DangerousChangeType.TYPE_ADDED_TO_UNION,
        description:
          'TypeInUnion2 was added to union type UnionTypeThatGainsAType.',
      },
    ];

    expect(findDangerousChanges(oldSchema, newSchema)).to.eql(
      expectedDangerousChanges,
    );
  });

  it('should detect if an optional field argument was added', () => {
    const oldSchema = buildSchema(`
      type Type1 {
        field1(arg1: String): String
      }

      type Query {
        field1: String
      }
    `);

    const newSchema = buildSchema(`
      type Type1 {
        field1(arg1: String, arg2: String): String
      }

      type Query {
        field1: String
      }
    `);

    expect(findArgChanges(oldSchema, newSchema).dangerousChanges).to.eql([
      {
        type: DangerousChangeType.OPTIONAL_ARG_ADDED,
        description: 'An optional arg arg2 on Type1.field1 was added',
      },
    ]);
  });
});
