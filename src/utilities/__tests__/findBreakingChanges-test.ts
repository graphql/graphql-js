import { expect } from 'chai';
import { describe, it } from 'mocha';

import {
  GraphQLDeprecatedDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLSpecifiedByDirective,
} from '../../type/directives';
import { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../buildASTSchema';
import {
  BreakingChangeType,
  DangerousChangeType,
  findBreakingChanges,
  findDangerousChanges,
} from '../findBreakingChanges';

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
      },
    ]);
    expect(findBreakingChanges(oldSchema, oldSchema)).to.deep.equal([]);
  });

  it('should detect if a standard scalar was removed', () => {
    const oldSchema = buildSchema(`
      type Query {
        foo: Float
      }
    `);

    const newSchema = buildSchema(`
      type Query {
        foo: String
      }
    `);
    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description:
          'Standard scalar Float was removed because it is not referenced anymore.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Query.foo changed type from Float to String.',
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
      },
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeWasInterfaceBecomesUnion changed from an Interface type to a Union type.',
      },
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeWasObjectBecomesInputObject changed from an Object type to an Input type.',
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
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field1 changed type from String to Int.',
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
      },
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Interface1.field1 arg objectArg was removed.',
      },
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Type1.field1 arg name was removed.',
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
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg2 has changed type from String to [String].',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg3 has changed type from [String] to String.',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg4 has changed type from String to String!.',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg5 has changed type from String! to Int.',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg6 has changed type from String! to Int!.',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg8 has changed type from Int to [Int]!.',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg9 has changed type from [Int] to [Int!].',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg11 has changed type from [Int] to [[Int]].',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg12 has changed type from [[Int]] to [Int].',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg13 has changed type from Int! to [Int]!.',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg15 has changed type from [[Int]!] to [[Int!]!].',
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
        type: BreakingChangeType.IMPLEMENTED_INTERFACE_REMOVED,
        description: 'Type1 no longer implements interface Interface1.',
      },
    ]);
  });

  it('should detect interfaces removed from interfaces', () => {
    const oldSchema = buildSchema(`
      interface Interface1

      interface Interface2 implements Interface1
    `);

    const newSchema = buildSchema(`
      interface Interface1

      interface Interface2
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.IMPLEMENTED_INTERFACE_REMOVED,
        description: 'Interface2 no longer implements interface Interface1.',
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

      directive @DirectiveThatWasRepeatable repeatable on FIELD_DEFINITION

      directive @DirectiveName on FIELD_DEFINITION | QUERY

      type ArgThatChanges {
        field1(id: Float): String
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

      directive @DirectiveThatWasRepeatable on FIELD_DEFINITION

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
        description:
          'Standard scalar Float was removed because it is not referenced anymore.',
      },
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'TypeThatGetsRemoved was removed.',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'ArgThatChanges.field1 arg id has changed type from Float to String.',
      },
      {
        type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
        description:
          'VALUE0 was removed from enum type EnumTypeThatLosesAValue.',
      },
      {
        type: BreakingChangeType.IMPLEMENTED_INTERFACE_REMOVED,
        description:
          'TypeThatLooseInterface1 no longer implements interface Interface1.',
      },
      {
        type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
        description:
          'TypeInUnion2 was removed from union type UnionTypeThatLosesAType.',
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
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: 'DirectiveThatIsRemoved was removed.',
      },
      {
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: 'arg1 was removed from DirectiveThatRemovesArg.',
      },
      {
        type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
        description:
          'A required arg arg1 on directive NonNullDirectiveAdded was added.',
      },
      {
        type: BreakingChangeType.DIRECTIVE_REPEATABLE_REMOVED,
        description:
          'Repeatable flag was removed from DirectiveThatWasRepeatable.',
      },
      {
        type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
        description: 'QUERY was removed from DirectiveName.',
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
      },
    ]);
  });

  it('should detect if a directive was implicitly removed', () => {
    const oldSchema = new GraphQLSchema({});

    const newSchema = new GraphQLSchema({
      directives: [
        GraphQLSkipDirective,
        GraphQLIncludeDirective,
        GraphQLSpecifiedByDirective,
      ],
    });

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: `${GraphQLDeprecatedDirective.name} was removed.`,
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

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
        description:
          'A required arg newRequiredArg on directive DirectiveName was added.',
      },
    ]);
  });

  it('should detect removal of repeatable flag', () => {
    const oldSchema = buildSchema(`
      directive @DirectiveName repeatable on OBJECT
    `);

    const newSchema = buildSchema(`
      directive @DirectiveName on OBJECT
    `);

    expect(findBreakingChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_REPEATABLE_REMOVED,
        description: 'Repeatable flag was removed from DirectiveName.',
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
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg stringArg has changed defaultValue from "test" to "Test".',
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg emptyArray has changed defaultValue from [] to [7].',
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg valueArray has changed defaultValue from [["a", "b"], ["c"]] to [["b", "a"], ["d"]].',
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg complexObject has changed defaultValue from {innerInputArray: [{arrayField: [1, 2, 3]}]} to {innerInputArray: [{arrayField: [3, 2, 1]}]}.',
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

  it('should ignore changes in field definitions order', () => {
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
        c: String
        b: String
        a: String
      }

      type Type1 {
        field1(
          arg1: Input1 = { a: "a", b: "b", c: "c" }
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
        type: DangerousChangeType.IMPLEMENTED_INTERFACE_ADDED,
        description: 'NewInterface added to interfaces implemented by Type1.',
      },
    ]);
  });

  it('should detect interfaces added to interfaces', () => {
    const oldSchema = buildSchema(`
      interface OldInterface
      interface NewInterface

      interface Interface1 implements OldInterface
    `);

    const newSchema = buildSchema(`
      interface OldInterface
      interface NewInterface

      interface Interface1 implements OldInterface & NewInterface
    `);

    expect(findDangerousChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: DangerousChangeType.IMPLEMENTED_INTERFACE_ADDED,
        description:
          'NewInterface added to interfaces implemented by Interface1.',
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
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg argThatChangesDefaultValue has changed defaultValue from "test" to "Test".',
      },
      {
        type: DangerousChangeType.IMPLEMENTED_INTERFACE_ADDED,
        description:
          'Interface1 added to interfaces implemented by TypeThatGainsInterface1.',
      },
      {
        type: DangerousChangeType.TYPE_ADDED_TO_UNION,
        description:
          'TypeInUnion2 was added to union type UnionTypeThatGainsAType.',
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
      },
    ]);
  });
});
