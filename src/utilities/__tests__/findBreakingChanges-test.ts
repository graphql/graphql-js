import { expect } from 'chai';
import { describe, it } from 'mocha';

import type {
  DirectiveDefinitionNode,
  EnumTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  ObjectTypeDefinitionNode,
} from '../../language/ast';
import { parse } from '../../language/parser';

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

function expectBreakingChanges(oldSDL: string, newSDL: string) {
  return expect(findBreakingChanges(buildSchema(oldSDL), buildSchema(newSDL)));
}

function expectDangerousChanges(oldSDL: string, newSDL: string) {
  return expect(findDangerousChanges(buildSchema(oldSDL), buildSchema(newSDL)));
}

describe('findBreakingChanges', () => {
  it('should detect if a type was removed or not', () => {
    const oldSDL = `
      type Type1
      type Type2
    `;

    const newSDL = `
      type Type2
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'Type1 was removed.',
      },
    ]);
    expectBreakingChanges(oldSDL, oldSDL).to.deep.equal([]);
  });

  it('should detect if a standard scalar was removed', () => {
    const oldSDL = `
      type Query {
        foo: Float
      }
    `;

    const newSDL = `
      type Query {
        foo: String
      }
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description:
          'Standard scalar Float was removed because it is not referenced anymore.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Query.foo changed type from Float to String.',
        oldAstNode: (parse(oldSDL).definitions[0] as ObjectTypeDefinitionNode)
          .fields?.[0],
        newAstNode: (parse(newSDL).definitions[0] as ObjectTypeDefinitionNode)
          .fields?.[0],
      },
    ]);
    expectBreakingChanges(oldSDL, oldSDL).to.deep.equal([]);
  });

  it('should detect if a type changed its type', () => {
    const oldSDL = `
      scalar TypeWasScalarBecomesEnum
      interface TypeWasInterfaceBecomesUnion
      type TypeWasObjectBecomesInputObject
    `;

    const newSDL = `
      enum TypeWasScalarBecomesEnum
      union TypeWasInterfaceBecomesUnion
      input TypeWasObjectBecomesInputObject
    `;

    const oldAst = parse(oldSDL);
    const newAst = parse(newSDL);

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeWasScalarBecomesEnum changed from a Scalar type to an Enum type.',
        oldAstNode: oldAst.definitions[0],
        newAstNode: newAst.definitions[0],
      },
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeWasInterfaceBecomesUnion changed from an Interface type to a Union type.',
        oldAstNode: oldAst.definitions[1],
        newAstNode: newAst.definitions[1],
      },
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeWasObjectBecomesInputObject changed from an Object type to an Input type.',
        oldAstNode: oldAst.definitions[2],
        newAstNode: newAst.definitions[2],
      },
    ]);
  });

  it('should detect if a field on a type was deleted or changed type', () => {
    const oldSDL = `
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
    `;

    const newSDL = `
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
    `;

    const oldAst = parse(oldSDL);
    const newAst = parse(newSDL);

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'Type1.field2 was removed.',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[1],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field3 changed type from String to Boolean.',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[2],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[1],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field4 changed type from TypeA to TypeB.',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[3],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[2],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field6 changed type from String to [String].',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[4],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[4],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field7 changed type from [String] to String.',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[5],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[5],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field9 changed type from Int! to Int.',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[7],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[7],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field10 changed type from [Int]! to [Int].',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[8],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[8],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field11 changed type from Int to [Int]!.',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[9],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[9],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field13 changed type from [Int!] to [Int].',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[11],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[11],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field14 changed type from [Int] to [[Int]].',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[12],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[12],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field15 changed type from [[Int]] to [Int].',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[13],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[13],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field16 changed type from Int! to [Int]!.',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[14],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[14],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field18 changed type from [[Int!]!] to [[Int!]].',
        oldAstNode: (oldAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[16],
        newAstNode: (newAst.definitions[2] as InterfaceTypeDefinitionNode)
          .fields?.[16],
      },
    ]);
  });

  it('should detect if fields on input types changed kind or were removed', () => {
    const oldSDL = `
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
    `;

    const newSDL = `
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
    `;

    const oldAst = parse(oldSDL);
    const newAst = parse(newSDL);

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'InputType1.field2 was removed.',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[1],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field1 changed type from String to Int.',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[0],
        newAstNode: (newAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[0],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field3 changed type from [String] to String.',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[2],
        newAstNode: (newAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[1],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field5 changed type from String to String!.',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[4],
        newAstNode: (newAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[3],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field6 changed type from [Int] to [Int]!.',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[5],
        newAstNode: (newAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[4],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field8 changed type from Int to [Int]!.',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[7],
        newAstNode: (newAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[6],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field9 changed type from [Int] to [Int!].',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[8],
        newAstNode: (newAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[7],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field11 changed type from [Int] to [[Int]].',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[10],
        newAstNode: (newAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[9],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field12 changed type from [[Int]] to [Int].',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[11],
        newAstNode: (newAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[10],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'InputType1.field13 changed type from Int! to [Int]!.',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[12],
        newAstNode: (newAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[11],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description:
          'InputType1.field15 changed type from [[Int]!] to [[Int!]!].',
        oldAstNode: (oldAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[14],
        newAstNode: (newAst.definitions[0] as InputObjectTypeDefinitionNode)
          .fields?.[13],
      },
    ]);
  });

  it('should detect if a required field is added to an input type', () => {
    const oldSDL = `
      input InputType1 {
        field1: String
      }
    `;

    const newSDL = `
      input InputType1 {
        field1: String
        requiredField: Int!
        optionalField1: Boolean
        optionalField2: Boolean! = false
      }
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
        description:
          'A required field requiredField on input type InputType1 was added.',
        newAstNode: (
          parse(newSDL).definitions[0] as InputObjectTypeDefinitionNode
        ).fields?.[1],
      },
    ]);
  });

  it('should detect if a type was removed from a union type', () => {
    const oldSDL = `
      type Type1
      type Type2
      type Type3

      union UnionType1 = Type1 | Type2
    `;
    const newSDL = `
      type Type1
      type Type2
      type Type3

      union UnionType1 = Type1 | Type3
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
        description: 'Type2 was removed from union type UnionType1.',
        oldAstNode: parse(oldSDL).definitions[1],
      },
    ]);
  });

  it('should detect if a value was removed from an enum type', () => {
    const oldSDL = `
      enum EnumType1 {
        VALUE0
        VALUE1
        VALUE2
      }
    `;

    const newSDL = `    
      enum EnumType1 {
        VALUE0
        VALUE2
        VALUE3
      }
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
        description: 'VALUE1 was removed from enum type EnumType1.',
        oldAstNode: parse(oldSDL).definitions[0],
        newAstNode: parse(newSDL).definitions[0],
      },
    ]);
  });

  it('should detect if a field argument was removed', () => {
    const oldSDL = `
      interface Interface1 {
        field1(arg1: Boolean, objectArg: String): String
      }

      type Type1 {
        field1(name: String): String
      }
    `;

    const newSDL = `
      interface Interface1 {
        field1: String
      }

      type Type1 {
        field1: String
      }
    `;

    const oldAst = parse(oldSDL);

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Interface1.field1 arg arg1 was removed.',
        oldAstNode: (oldAst.definitions[0] as InterfaceTypeDefinitionNode)
          .fields?.[0].arguments?.[0],
      },
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Interface1.field1 arg objectArg was removed.',
        oldAstNode: (oldAst.definitions[0] as InterfaceTypeDefinitionNode)
          .fields?.[0].arguments?.[1],
      },
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Type1.field1 arg name was removed.',
        oldAstNode: (oldAst.definitions[1] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[0],
      },
    ]);
  });

  it('should detect if a field argument has changed type', () => {
    const oldSDL = `
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
    `;

    const newSDL = `
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
    `;

    const expectedOldAstNode = (
      parse(oldSDL).definitions[0] as ObjectTypeDefinitionNode
    ).fields?.[0];
    const expectedNewAstNode = (
      parse(newSDL).definitions[0] as ObjectTypeDefinitionNode
    ).fields?.[0];

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg1 has changed type from String to Int.',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg2 has changed type from String to [String].',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg3 has changed type from [String] to String.',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg4 has changed type from String to String!.',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg5 has changed type from String! to Int.',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg6 has changed type from String! to Int!.',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg8 has changed type from Int to [Int]!.',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg9 has changed type from [Int] to [Int!].',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg11 has changed type from [Int] to [[Int]].',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg12 has changed type from [[Int]] to [Int].',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg13 has changed type from Int! to [Int]!.',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description:
          'Type1.field1 arg arg15 has changed type from [[Int]!] to [[Int!]!].',
        oldAstNode: expectedOldAstNode,
        newAstNode: expectedNewAstNode,
      },
    ]);
  });

  it('should detect if a required field argument was added', () => {
    const oldSDL = `
      type Type1 {
        field1(arg1: String): String
      }
    `;

    const newSDL = `
      type Type1 {
        field1(
          arg1: String,
          newRequiredArg: String!
          newOptionalArg1: Int
          newOptionalArg2: Int! = 0
        ): String
      }
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.REQUIRED_ARG_ADDED,
        description: 'A required arg newRequiredArg on Type1.field1 was added.',
        newAstNode: (parse(newSDL).definitions[0] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[1],
      },
    ]);
  });

  it('should not flag args with the same type signature as breaking', () => {
    const oldSDL = `
      input InputType1 {
        field1: String
      }

      type Type1 {
        field1(arg1: Int!, arg2: InputType1): Int
      }
    `;

    const newSDL = `
      input InputType1 {
        field1: String
      }

      type Type1 {
        field1(arg1: Int!, arg2: InputType1): Int
      }
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([]);
  });

  it('should consider args that move away from NonNull as non-breaking', () => {
    const oldSDL = `
      type Type1 {
        field1(name: String!): String
      }
    `;

    const newSDL = `
      type Type1 {
        field1(name: String): String
      }
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([]);
  });

  it('should detect interfaces removed from types', () => {
    const oldSDL = `
      interface Interface1

      type Type1 implements Interface1
    `;

    const newSDL = `
      interface Interface1

      type Type1
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.IMPLEMENTED_INTERFACE_REMOVED,
        description: 'Type1 no longer implements interface Interface1.',
        oldAstNode: parse(oldSDL).definitions[1],
        newAstNode: parse(newSDL).definitions[1],
      },
    ]);
  });

  it('should detect interfaces removed from interfaces', () => {
    const oldSDL = `
      interface Interface1

      interface Interface2 implements Interface1
    `;

    const newSDL = `
      interface Interface1

      interface Interface2
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.IMPLEMENTED_INTERFACE_REMOVED,
        description: 'Interface2 no longer implements interface Interface1.',
        oldAstNode: parse(oldSDL).definitions[1],
        newAstNode: parse(newSDL).definitions[1],
      },
    ]);
  });

  it('should ignore changes in order of interfaces', () => {
    const oldSDL = `
      interface FirstInterface
      interface SecondInterface

      type Type1 implements FirstInterface & SecondInterface
    `;

    const newSDL = `
      interface FirstInterface
      interface SecondInterface

      type Type1 implements SecondInterface & FirstInterface
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([]);
  });

  it('should detect all breaking changes', () => {
    const oldSDL = `
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
    `;

    const newSDL = `
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
    `;

    const oldAst = parse(oldSDL);
    const newAst = parse(newSDL);

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
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
        oldAstNode: (oldAst.definitions[5] as ObjectTypeDefinitionNode)
          .fields?.[0],
        newAstNode: (newAst.definitions[4] as ObjectTypeDefinitionNode)
          .fields?.[0],
      },
      {
        type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
        description:
          'VALUE0 was removed from enum type EnumTypeThatLosesAValue.',
        oldAstNode: oldAst.definitions[6] as EnumTypeDefinitionNode,
        newAstNode: newAst.definitions[5] as EnumTypeDefinitionNode,
      },
      {
        type: BreakingChangeType.IMPLEMENTED_INTERFACE_REMOVED,
        description:
          'TypeThatLooseInterface1 no longer implements interface Interface1.',
        oldAstNode: oldAst.definitions[8],
        newAstNode: newAst.definitions[7],
      },
      {
        type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
        description:
          'TypeInUnion2 was removed from union type UnionTypeThatLosesAType.',
        oldAstNode: oldAst.definitions[10],
      },
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          'TypeThatChangesType changed from an Object type to an Interface type.',
        oldAstNode: oldAst.definitions[12],
        newAstNode: newAst.definitions[11],
      },
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'TypeThatHasBreakingFieldChanges.field1 was removed.',
        oldAstNode: (oldAst.definitions[14] as InterfaceTypeDefinitionNode)
          .fields?.[0],
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description:
          'TypeThatHasBreakingFieldChanges.field2 changed type from String to Boolean.',
        oldAstNode: (oldAst.definitions[14] as InterfaceTypeDefinitionNode)
          .fields?.[1],
        newAstNode: (newAst.definitions[12] as InterfaceTypeDefinitionNode)
          .fields?.[0],
      },
      {
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: 'DirectiveThatIsRemoved was removed.',
        oldAstNode: oldAst.definitions[0],
      },
      {
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: 'arg1 was removed from DirectiveThatRemovesArg.',
        oldAstNode: (oldAst.definitions[1] as DirectiveDefinitionNode)
          .arguments?.[0],
      },
      {
        type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
        description:
          'A required arg arg1 on directive NonNullDirectiveAdded was added.',
        newAstNode: (newAst.definitions[1] as DirectiveDefinitionNode)
          .arguments?.[0],
      },
      {
        type: BreakingChangeType.DIRECTIVE_REPEATABLE_REMOVED,
        description:
          'Repeatable flag was removed from DirectiveThatWasRepeatable.',
        oldAstNode: oldAst.definitions[3],
        newAstNode: newAst.definitions[2],
      },
      {
        type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
        description: 'QUERY was removed from DirectiveName.',
        oldAstNode: oldAst.definitions[4],
        newAstNode: newAst.definitions[3],
      },
    ]);
  });

  it('should detect if a directive was explicitly removed', () => {
    const oldSDL = `
      directive @DirectiveThatIsRemoved on FIELD_DEFINITION
      directive @DirectiveThatStays on FIELD_DEFINITION
    `;

    const newSDL = `
      directive @DirectiveThatStays on FIELD_DEFINITION
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: 'DirectiveThatIsRemoved was removed.',
        oldAstNode: parse(oldSDL).definitions[0],
      },
    ]);
  });

  it('should detect if a directive was implicitly removed', () => {
    const oldSDL = new GraphQLSchema({});

    const newSDL = new GraphQLSchema({
      directives: [
        GraphQLSkipDirective,
        GraphQLIncludeDirective,
        GraphQLSpecifiedByDirective,
      ],
    });

    expect(findBreakingChanges(oldSDL, newSDL)).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: `${GraphQLDeprecatedDirective.name} was removed.`,
        oldAstNode: undefined,
      },
    ]);
  });

  it('should detect if a directive argument was removed', () => {
    const oldSDL = `
      directive @DirectiveWithArg(arg1: String) on FIELD_DEFINITION
    `;

    const newSDL = `
      directive @DirectiveWithArg on FIELD_DEFINITION
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: 'arg1 was removed from DirectiveWithArg.',
        oldAstNode: (parse(oldSDL).definitions[0] as DirectiveDefinitionNode)
          .arguments?.[0],
      },
    ]);
  });

  it('should detect if an optional directive argument was added', () => {
    const oldSDL = `
      directive @DirectiveName on FIELD_DEFINITION
    `;

    const newSDL = `
      directive @DirectiveName(
        newRequiredArg: String!
        newOptionalArg1: Int
        newOptionalArg2: Int! = 0
      ) on FIELD_DEFINITION
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
        description:
          'A required arg newRequiredArg on directive DirectiveName was added.',
        newAstNode: (parse(newSDL).definitions[0] as DirectiveDefinitionNode)
          .arguments?.[0],
      },
    ]);
  });

  it('should detect removal of repeatable flag', () => {
    const oldSDL = `
      directive @DirectiveName repeatable on OBJECT
    `;

    const newSDL = `
      directive @DirectiveName on OBJECT
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_REPEATABLE_REMOVED,
        description: 'Repeatable flag was removed from DirectiveName.',
        oldAstNode: parse(oldSDL).definitions[0],
        newAstNode: parse(newSDL).definitions[0],
      },
    ]);
  });

  it('should detect locations removed from a directive', () => {
    const oldSDL = `
      directive @DirectiveName on FIELD_DEFINITION | QUERY
    `;

    const newSDL = `
      directive @DirectiveName on FIELD_DEFINITION
    `;

    expectBreakingChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
        description: 'QUERY was removed from DirectiveName.',
        oldAstNode: parse(oldSDL).definitions[0],
        newAstNode: parse(newSDL).definitions[0],
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

    expectDangerousChanges(oldSDL, oldSDL).to.deep.equal([]);

    const newSDL = `
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
    `;

    const oldAst = parse(oldSDL);
    const newAst = parse(newSDL);

    expectDangerousChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg withDefaultValue defaultValue was removed.',
        oldAstNode: (oldAst.definitions[2] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[0],
        newAstNode: (newAst.definitions[2] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[0],
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg stringArg has changed defaultValue from "test" to "Test".',
        oldAstNode: (oldAst.definitions[2] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[1],
        newAstNode: (newAst.definitions[2] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[1],
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg emptyArray has changed defaultValue from [] to [7].',
        oldAstNode: (oldAst.definitions[2] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[2],
        newAstNode: (newAst.definitions[2] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[2],
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg valueArray has changed defaultValue from [["a", "b"], ["c"]] to [["b", "a"], ["d"]].',
        oldAstNode: (oldAst.definitions[2] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[3],
        newAstNode: (newAst.definitions[2] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[3],
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg complexObject has changed defaultValue from {innerInputArray: [{arrayField: [1, 2, 3]}]} to {innerInputArray: [{arrayField: [3, 2, 1]}]}.',
        oldAstNode: (oldAst.definitions[2] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[4],
        newAstNode: (newAst.definitions[2] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[4],
      },
    ]);
  });

  it('should ignore changes in field order of defaultValue', () => {
    const oldSDL = `
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
    `;

    const newSDL = `
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
    `;

    expectDangerousChanges(oldSDL, newSDL).to.deep.equal([]);
  });

  it('should ignore changes in field definitions order', () => {
    const oldSDL = `
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
    `;

    const newSDL = `
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
    `;

    expectDangerousChanges(oldSDL, newSDL).to.deep.equal([]);
  });

  it('should detect if a value was added to an enum type', () => {
    const oldSDL = `
      enum EnumType1 {
        VALUE0
        VALUE1
      }
    `;

    const newSDL = `
      enum EnumType1 {
        VALUE0
        VALUE1
        VALUE2
      }
    `;

    expectDangerousChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
        description: 'VALUE2 was added to enum type EnumType1.',
        oldAstNode: parse(oldSDL).definitions[0],
        newAstNode: parse(newSDL).definitions[0],
      },
    ]);
  });

  it('should detect interfaces added to types', () => {
    const oldSDL = `
      interface OldInterface
      interface NewInterface

      type Type1 implements OldInterface
    `;

    const newSDL = `
      interface OldInterface
      interface NewInterface

      type Type1 implements OldInterface & NewInterface
    `;

    expectDangerousChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: DangerousChangeType.IMPLEMENTED_INTERFACE_ADDED,
        description: 'NewInterface added to interfaces implemented by Type1.',
        oldAstNode: parse(oldSDL).definitions[2],
        newAstNode: parse(newSDL).definitions[2],
      },
    ]);
  });

  it('should detect interfaces added to interfaces', () => {
    const oldSDL = `
      interface OldInterface
      interface NewInterface

      interface Interface1 implements OldInterface
    `;

    const newSDL = `
      interface OldInterface
      interface NewInterface

      interface Interface1 implements OldInterface & NewInterface
    `;

    expectDangerousChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: DangerousChangeType.IMPLEMENTED_INTERFACE_ADDED,
        description:
          'NewInterface added to interfaces implemented by Interface1.',
        oldAstNode: parse(oldSDL).definitions[2],
        newAstNode: parse(newSDL).definitions[2],
      },
    ]);
  });

  it('should detect if a type was added to a union type', () => {
    const oldSDL = `
      type Type1
      type Type2

      union UnionType1 = Type1
    `;

    const newSDL = `
      type Type1
      type Type2

      union UnionType1 = Type1 | Type2
    `;

    expectDangerousChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: DangerousChangeType.TYPE_ADDED_TO_UNION,
        description: 'Type2 was added to union type UnionType1.',
        newAstNode: parse(newSDL).definitions[1],
      },
    ]);
  });

  it('should detect if an optional field was added to an input', () => {
    const oldSDL = `
      input InputType1 {
        field1: String
      }
    `;

    const newSDL = `
      input InputType1 {
        field1: String
        field2: Int
      }
    `;

    expectDangerousChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
        description:
          'An optional field field2 on input type InputType1 was added.',
        newAstNode: (
          parse(newSDL).definitions[0] as InputObjectTypeDefinitionNode
        ).fields?.[1],
      },
    ]);
  });

  it('should find all dangerous changes', () => {
    const oldSDL = `
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
    `;

    const newSDL = `
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
    `;

    const oldAst = parse(oldSDL);
    const newAst = parse(newSDL);

    expectDangerousChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
        description: 'VALUE2 was added to enum type EnumType1.',
        oldAstNode: oldAst.definitions[0],
        newAstNode: newAst.definitions[0],
      },
      {
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
        description:
          'Type1.field1 arg argThatChangesDefaultValue has changed defaultValue from "test" to "Test".',
        oldAstNode: (oldAst.definitions[1] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[0],
        newAstNode: (newAst.definitions[1] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[0],
      },
      {
        type: DangerousChangeType.IMPLEMENTED_INTERFACE_ADDED,
        description:
          'Interface1 added to interfaces implemented by TypeThatGainsInterface1.',
        oldAstNode: oldAst.definitions[3],
        newAstNode: newAst.definitions[3],
      },
      {
        type: DangerousChangeType.TYPE_ADDED_TO_UNION,
        description:
          'TypeInUnion2 was added to union type UnionTypeThatGainsAType.',
        newAstNode: newAst.definitions[5],
      },
    ]);
  });

  it('should detect if an optional field argument was added', () => {
    const oldSDL = `
      type Type1 {
        field1(arg1: String): String
      }
    `;

    const newSDL = `
      type Type1 {
        field1(arg1: String, arg2: String): String
      }
    `;

    expectDangerousChanges(oldSDL, newSDL).to.deep.equal([
      {
        type: DangerousChangeType.OPTIONAL_ARG_ADDED,
        description: 'An optional arg arg2 on Type1.field1 was added.',
        newAstNode: (parse(newSDL).definitions[0] as ObjectTypeDefinitionNode)
          .fields?.[0].arguments?.[1],
      },
    ]);
  });
});
