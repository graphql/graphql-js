import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON';

import { inspect } from '../../jsutils/inspect';

import { parse } from '../../language/parser';

import { GraphQLObjectType, GraphQLScalarType } from '../../type/definition';
import { GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { ValuesOfCorrectTypeRule } from '../rules/ValuesOfCorrectTypeRule';
import { validate } from '../validate';

import {
  expectValidationErrors,
  expectValidationErrorsWithSchema,
} from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(ValuesOfCorrectTypeRule, queryStr);
}

function expectErrorsWithSchema(schema: GraphQLSchema, queryStr: string) {
  return expectValidationErrorsWithSchema(
    schema,
    ValuesOfCorrectTypeRule,
    queryStr,
  );
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

function expectValidWithSchema(schema: GraphQLSchema, queryStr: string) {
  expectErrorsWithSchema(schema, queryStr).toDeepEqual([]);
}

describe('Validate: Values of correct type', () => {
  describe('Valid values', () => {
    it('Good int value', () => {
      expectValid(`
        {
          complicatedArgs {
            intArgField(intArg: 2)
          }
        }
      `);
    });

    it('Good negative int value', () => {
      expectValid(`
        {
          complicatedArgs {
            intArgField(intArg: -2)
          }
        }
      `);
    });

    it('Good boolean value', () => {
      expectValid(`
        {
          complicatedArgs {
            booleanArgField(booleanArg: true)
          }
        }
      `);
    });

    it('Good string value', () => {
      expectValid(`
        {
          complicatedArgs {
            stringArgField(stringArg: "foo")
          }
        }
      `);
    });

    it('Good float value', () => {
      expectValid(`
        {
          complicatedArgs {
            floatArgField(floatArg: 1.1)
          }
        }
      `);
    });

    it('Good negative float value', () => {
      expectValid(`
        {
          complicatedArgs {
            floatArgField(floatArg: -1.1)
          }
        }
      `);
    });

    it('Int into Float', () => {
      expectValid(`
        {
          complicatedArgs {
            floatArgField(floatArg: 1)
          }
        }
      `);
    });

    it('Int into ID', () => {
      expectValid(`
        {
          complicatedArgs {
            idArgField(idArg: 1)
          }
        }
      `);
    });

    it('String into ID', () => {
      expectValid(`
        {
          complicatedArgs {
            idArgField(idArg: "someIdString")
          }
        }
      `);
    });

    it('Good enum value', () => {
      expectValid(`
        {
          dog {
            doesKnowCommand(dogCommand: SIT)
          }
        }
      `);
    });

    it('Enum with undefined value', () => {
      expectValid(`
        {
          complicatedArgs {
            enumArgField(enumArg: UNKNOWN)
          }
        }
      `);
    });

    it('Enum with null value', () => {
      expectValid(`
        {
          complicatedArgs {
            enumArgField(enumArg: NO_FUR)
          }
        }
      `);
    });

    it('null into nullable type', () => {
      expectValid(`
        {
          complicatedArgs {
            intArgField(intArg: null)
          }
        }
      `);

      expectValid(`
        {
          dog(a: null, b: null, c:{ requiredField: true, intField: null }) {
            name
          }
        }
      `);
    });
  });

  describe('Invalid String values', () => {
    it('Int into String', () => {
      expectErrors(`
        {
          complicatedArgs {
            stringArgField(stringArg: 1)
          }
        }
      `).toDeepEqual([
        {
          message: 'String cannot represent a non string value: 1',
          locations: [{ line: 4, column: 39 }],
        },
      ]);
    });

    it('Float into String', () => {
      expectErrors(`
        {
          complicatedArgs {
            stringArgField(stringArg: 1.0)
          }
        }
      `).toDeepEqual([
        {
          message: 'String cannot represent a non string value: 1.0',
          locations: [{ line: 4, column: 39 }],
        },
      ]);
    });

    it('Boolean into String', () => {
      expectErrors(`
        {
          complicatedArgs {
            stringArgField(stringArg: true)
          }
        }
      `).toDeepEqual([
        {
          message: 'String cannot represent a non string value: true',
          locations: [{ line: 4, column: 39 }],
        },
      ]);
    });

    it('Unquoted String into String', () => {
      expectErrors(`
        {
          complicatedArgs {
            stringArgField(stringArg: BAR)
          }
        }
      `).toDeepEqual([
        {
          message: 'String cannot represent a non string value: BAR',
          locations: [{ line: 4, column: 39 }],
        },
      ]);
    });
  });

  describe('Invalid Int values', () => {
    it('String into Int', () => {
      expectErrors(`
        {
          complicatedArgs {
            intArgField(intArg: "3")
          }
        }
      `).toDeepEqual([
        {
          message: 'Int cannot represent non-integer value: "3"',
          locations: [{ line: 4, column: 33 }],
        },
      ]);
    });

    it('Big Int into Int', () => {
      expectErrors(`
        {
          complicatedArgs {
            intArgField(intArg: 829384293849283498239482938)
          }
        }
      `).toDeepEqual([
        {
          message:
            'Int cannot represent non 32-bit signed integer value: 829384293849283498239482938',
          locations: [{ line: 4, column: 33 }],
        },
      ]);
    });

    it('Unquoted String into Int', () => {
      expectErrors(`
        {
          complicatedArgs {
            intArgField(intArg: FOO)
          }
        }
      `).toDeepEqual([
        {
          message: 'Int cannot represent non-integer value: FOO',
          locations: [{ line: 4, column: 33 }],
        },
      ]);
    });

    it('Simple Float into Int', () => {
      expectErrors(`
        {
          complicatedArgs {
            intArgField(intArg: 3.0)
          }
        }
      `).toDeepEqual([
        {
          message: 'Int cannot represent non-integer value: 3.0',
          locations: [{ line: 4, column: 33 }],
        },
      ]);
    });

    it('Float into Int', () => {
      expectErrors(`
        {
          complicatedArgs {
            intArgField(intArg: 3.333)
          }
        }
      `).toDeepEqual([
        {
          message: 'Int cannot represent non-integer value: 3.333',
          locations: [{ line: 4, column: 33 }],
        },
      ]);
    });
  });

  describe('Invalid Float values', () => {
    it('String into Float', () => {
      expectErrors(`
        {
          complicatedArgs {
            floatArgField(floatArg: "3.333")
          }
        }
      `).toDeepEqual([
        {
          message: 'Float cannot represent non numeric value: "3.333"',
          locations: [{ line: 4, column: 37 }],
        },
      ]);
    });

    it('Boolean into Float', () => {
      expectErrors(`
        {
          complicatedArgs {
            floatArgField(floatArg: true)
          }
        }
      `).toDeepEqual([
        {
          message: 'Float cannot represent non numeric value: true',
          locations: [{ line: 4, column: 37 }],
        },
      ]);
    });

    it('Unquoted into Float', () => {
      expectErrors(`
        {
          complicatedArgs {
            floatArgField(floatArg: FOO)
          }
        }
      `).toDeepEqual([
        {
          message: 'Float cannot represent non numeric value: FOO',
          locations: [{ line: 4, column: 37 }],
        },
      ]);
    });
  });

  describe('Invalid Boolean value', () => {
    it('Int into Boolean', () => {
      expectErrors(`
        {
          complicatedArgs {
            booleanArgField(booleanArg: 2)
          }
        }
      `).toDeepEqual([
        {
          message: 'Boolean cannot represent a non boolean value: 2',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });

    it('Float into Boolean', () => {
      expectErrors(`
        {
          complicatedArgs {
            booleanArgField(booleanArg: 1.0)
          }
        }
      `).toDeepEqual([
        {
          message: 'Boolean cannot represent a non boolean value: 1.0',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });

    it('String into Boolean', () => {
      expectErrors(`
        {
          complicatedArgs {
            booleanArgField(booleanArg: "true")
          }
        }
      `).toDeepEqual([
        {
          message: 'Boolean cannot represent a non boolean value: "true"',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });

    it('Unquoted into Boolean', () => {
      expectErrors(`
        {
          complicatedArgs {
            booleanArgField(booleanArg: TRUE)
          }
        }
      `).toDeepEqual([
        {
          message: 'Boolean cannot represent a non boolean value: TRUE',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });
  });

  describe('Invalid ID value', () => {
    it('Float into ID', () => {
      expectErrors(`
        {
          complicatedArgs {
            idArgField(idArg: 1.0)
          }
        }
      `).toDeepEqual([
        {
          message:
            'ID cannot represent a non-string and non-integer value: 1.0',
          locations: [{ line: 4, column: 31 }],
        },
      ]);
    });

    it('Boolean into ID', () => {
      expectErrors(`
        {
          complicatedArgs {
            idArgField(idArg: true)
          }
        }
      `).toDeepEqual([
        {
          message:
            'ID cannot represent a non-string and non-integer value: true',
          locations: [{ line: 4, column: 31 }],
        },
      ]);
    });

    it('Unquoted into ID', () => {
      expectErrors(`
        {
          complicatedArgs {
            idArgField(idArg: SOMETHING)
          }
        }
      `).toDeepEqual([
        {
          message:
            'ID cannot represent a non-string and non-integer value: SOMETHING',
          locations: [{ line: 4, column: 31 }],
        },
      ]);
    });
  });

  describe('Invalid Enum value', () => {
    it('Int into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: 2)
          }
        }
      `).toDeepEqual([
        {
          message: 'Enum "DogCommand" cannot represent non-enum value: 2.',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });

    it('Float into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: 1.0)
          }
        }
      `).toDeepEqual([
        {
          message: 'Enum "DogCommand" cannot represent non-enum value: 1.0.',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });

    it('String into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: "SIT")
          }
        }
      `).toDeepEqual([
        {
          message:
            'Enum "DogCommand" cannot represent non-enum value: "SIT". Did you mean the enum value "SIT"?',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });

    it('Boolean into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: true)
          }
        }
      `).toDeepEqual([
        {
          message: 'Enum "DogCommand" cannot represent non-enum value: true.',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });

    it('Unknown Enum Value into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: JUGGLE)
          }
        }
      `).toDeepEqual([
        {
          message: 'Value "JUGGLE" does not exist in "DogCommand" enum.',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });

    it('Different case Enum Value into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: sit)
          }
        }
      `).toDeepEqual([
        {
          message:
            'Value "sit" does not exist in "DogCommand" enum. Did you mean the enum value "SIT"?',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });
  });

  describe('Valid List value', () => {
    it('Good list value', () => {
      expectValid(`
        {
          complicatedArgs {
            stringListArgField(stringListArg: ["one", null, "two"])
          }
        }
      `);
    });

    it('Empty list value', () => {
      expectValid(`
        {
          complicatedArgs {
            stringListArgField(stringListArg: [])
          }
        }
      `);
    });

    it('Null value', () => {
      expectValid(`
        {
          complicatedArgs {
            stringListArgField(stringListArg: null)
          }
        }
      `);
    });

    it('Single value into List', () => {
      expectValid(`
        {
          complicatedArgs {
            stringListArgField(stringListArg: "one")
          }
        }
      `);
    });
  });

  describe('Invalid List value', () => {
    it('Incorrect item type', () => {
      expectErrors(`
        {
          complicatedArgs {
            stringListArgField(stringListArg: ["one", 2])
          }
        }
      `).toDeepEqual([
        {
          message: 'String cannot represent a non string value: 2',
          locations: [{ line: 4, column: 55 }],
        },
      ]);
    });

    it('Single value of incorrect type', () => {
      expectErrors(`
        {
          complicatedArgs {
            stringListArgField(stringListArg: 1)
          }
        }
      `).toDeepEqual([
        {
          message: 'String cannot represent a non string value: 1',
          locations: [{ line: 4, column: 47 }],
        },
      ]);
    });
  });

  describe('Valid non-nullable value', () => {
    it('Arg on optional arg', () => {
      expectValid(`
        {
          dog {
            isHouseTrained(atOtherHomes: true)
          }
        }
      `);
    });

    it('No Arg on optional arg', () => {
      expectValid(`
        {
          dog {
            isHouseTrained
          }
        }
      `);
    });

    it('Multiple args', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleReqs(req1: 1, req2: 2)
          }
        }
      `);
    });

    it('Multiple args reverse order', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleReqs(req2: 2, req1: 1)
          }
        }
      `);
    });

    it('No args on multiple optional', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOpts
          }
        }
      `);
    });

    it('One arg on multiple optional', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOpts(opt1: 1)
          }
        }
      `);
    });

    it('Second arg on multiple optional', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOpts(opt2: 1)
          }
        }
      `);
    });

    it('Multiple required args on mixedList', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4)
          }
        }
      `);
    });

    it('Multiple required and one optional arg on mixedList', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5)
          }
        }
      `);
    });

    it('All required and optional args on mixedList', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5, opt2: 6)
          }
        }
      `);
    });
  });

  describe('Invalid non-nullable value', () => {
    it('Incorrect value type', () => {
      expectErrors(`
        {
          complicatedArgs {
            multipleReqs(req2: "two", req1: "one")
          }
        }
      `).toDeepEqual([
        {
          message: 'Int cannot represent non-integer value: "two"',
          locations: [{ line: 4, column: 32 }],
        },
        {
          message: 'Int cannot represent non-integer value: "one"',
          locations: [{ line: 4, column: 45 }],
        },
      ]);
    });

    it('Incorrect value and missing argument (ProvidedRequiredArgumentsRule)', () => {
      expectErrors(`
        {
          complicatedArgs {
            multipleReqs(req1: "one")
          }
        }
      `).toDeepEqual([
        {
          message: 'Int cannot represent non-integer value: "one"',
          locations: [{ line: 4, column: 32 }],
        },
      ]);
    });

    it('Null value', () => {
      expectErrors(`
        {
          complicatedArgs {
            multipleReqs(req1: null)
          }
        }
      `).toDeepEqual([
        {
          message: 'Expected value of type "Int!", found null.',
          locations: [{ line: 4, column: 32 }],
        },
      ]);
    });
  });

  describe('Valid input object value', () => {
    it('Optional arg, despite required field in type', () => {
      expectValid(`
        {
          complicatedArgs {
            complexArgField
          }
        }
      `);
    });

    it('Partial object, only required', () => {
      expectValid(`
        {
          complicatedArgs {
            complexArgField(complexArg: { requiredField: true })
          }
        }
      `);
    });

    it('Partial object, required field can be falsy', () => {
      expectValid(`
        {
          complicatedArgs {
            complexArgField(complexArg: { requiredField: false })
          }
        }
      `);
    });

    it('Partial object, including required', () => {
      expectValid(`
        {
          complicatedArgs {
            complexArgField(complexArg: { requiredField: true, intField: 4 })
          }
        }
      `);
    });

    it('Full object', () => {
      expectValid(`
        {
          complicatedArgs {
            complexArgField(complexArg: {
              requiredField: true,
              intField: 4,
              stringField: "foo",
              booleanField: false,
              stringListField: ["one", "two"]
            })
          }
        }
      `);
    });

    it('Full object with fields in different order', () => {
      expectValid(`
        {
          complicatedArgs {
            complexArgField(complexArg: {
              stringListField: ["one", "two"],
              booleanField: false,
              requiredField: true,
              stringField: "foo",
              intField: 4,
            })
          }
        }
      `);
    });
  });

  describe('Invalid input object value', () => {
    it('Partial object, missing required', () => {
      expectErrors(`
        {
          complicatedArgs {
            complexArgField(complexArg: { intField: 4 })
          }
        }
      `).toDeepEqual([
        {
          message:
            'Field "ComplexInput.requiredField" of required type "Boolean!" was not provided.',
          locations: [{ line: 4, column: 41 }],
        },
      ]);
    });

    it('Partial object, invalid field type', () => {
      expectErrors(`
        {
          complicatedArgs {
            complexArgField(complexArg: {
              stringListField: ["one", 2],
              requiredField: true,
            })
          }
        }
      `).toDeepEqual([
        {
          message: 'String cannot represent a non string value: 2',
          locations: [{ line: 5, column: 40 }],
        },
      ]);
    });

    it('Partial object, null to non-null field', () => {
      expectErrors(`
        {
          complicatedArgs {
            complexArgField(complexArg: {
              requiredField: true,
              nonNullField: null,
            })
          }
        }
      `).toDeepEqual([
        {
          message: 'Expected value of type "Boolean!", found null.',
          locations: [{ line: 6, column: 29 }],
        },
      ]);
    });

    it('Partial object, unknown field arg', () => {
      expectErrors(`
        {
          complicatedArgs {
            complexArgField(complexArg: {
              requiredField: true,
              invalidField: "value"
            })
          }
        }
      `).toDeepEqual([
        {
          message:
            'Field "invalidField" is not defined by type "ComplexInput". Did you mean "intField"?',
          locations: [{ line: 6, column: 15 }],
        },
      ]);
    });

    it('reports original error for custom scalar which throws', () => {
      const customScalar = new GraphQLScalarType({
        name: 'Invalid',
        parseValue(value) {
          throw new Error(
            `Invalid scalar is always invalid: ${inspect(value)}`,
          );
        },
      });

      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            invalidArg: {
              type: GraphQLString,
              args: { arg: { type: customScalar } },
            },
          },
        }),
      });

      const doc = parse('{ invalidArg(arg: 123) }');
      const errors = validate(schema, doc, [ValuesOfCorrectTypeRule]);

      expectJSON(errors).toDeepEqual([
        {
          message:
            'Expected value of type "Invalid", found 123; Invalid scalar is always invalid: 123',
          locations: [{ line: 1, column: 19 }],
        },
      ]);

      expect(errors[0]).to.have.nested.property(
        'originalError.message',
        'Invalid scalar is always invalid: 123',
      );
    });

    it('reports error for custom scalar that returns undefined', () => {
      const customScalar = new GraphQLScalarType({
        name: 'CustomScalar',
        parseValue() {
          return undefined;
        },
      });

      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            invalidArg: {
              type: GraphQLString,
              args: { arg: { type: customScalar } },
            },
          },
        }),
      });

      expectErrorsWithSchema(schema, '{ invalidArg(arg: 123) }').toDeepEqual([
        {
          message: 'Expected value of type "CustomScalar", found 123.',
          locations: [{ line: 1, column: 19 }],
        },
      ]);
    });

    it('allows custom scalar to accept complex literals', () => {
      const customScalar = new GraphQLScalarType({ name: 'Any' });
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            anyArg: {
              type: GraphQLString,
              args: { arg: { type: customScalar } },
            },
          },
        }),
      });

      expectValidWithSchema(
        schema,
        `
          {
            test1: anyArg(arg: 123)
            test2: anyArg(arg: "abc")
            test3: anyArg(arg: [123, "abc"])
            test4: anyArg(arg: {deep: [123, "abc"]})
          }
        `,
      );
    });
  });

  describe('Directive arguments', () => {
    it('with directives of valid types', () => {
      expectValid(`
        {
          dog @include(if: true) {
            name
          }
          human @skip(if: false) {
            name
          }
        }
      `);
    });

    it('with directive with incorrect types', () => {
      expectErrors(`
        {
          dog @include(if: "yes") {
            name @skip(if: ENUM)
          }
        }
      `).toDeepEqual([
        {
          message: 'Boolean cannot represent a non boolean value: "yes"',
          locations: [{ line: 3, column: 28 }],
        },
        {
          message: 'Boolean cannot represent a non boolean value: ENUM',
          locations: [{ line: 4, column: 28 }],
        },
      ]);
    });
  });

  describe('Variable default values', () => {
    it('variables with valid default values', () => {
      expectValid(`
        query WithDefaultValues(
          $a: Int = 1,
          $b: String = "ok",
          $c: ComplexInput = { requiredField: true, intField: 3 }
          $d: Int! = 123
        ) {
          dog { name }
        }
      `);
    });

    it('variables with valid default null values', () => {
      expectValid(`
        query WithDefaultValues(
          $a: Int = null,
          $b: String = null,
          $c: ComplexInput = { requiredField: true, intField: null }
        ) {
          dog { name }
        }
      `);
    });

    it('variables with invalid default null values', () => {
      expectErrors(`
        query WithDefaultValues(
          $a: Int! = null,
          $b: String! = null,
          $c: ComplexInput = { requiredField: null, intField: null }
        ) {
          dog { name }
        }
      `).toDeepEqual([
        {
          message: 'Expected value of type "Int!", found null.',
          locations: [{ line: 3, column: 22 }],
        },
        {
          message: 'Expected value of type "String!", found null.',
          locations: [{ line: 4, column: 25 }],
        },
        {
          message: 'Expected value of type "Boolean!", found null.',
          locations: [{ line: 5, column: 47 }],
        },
      ]);
    });

    it('variables with invalid default values', () => {
      expectErrors(`
        query InvalidDefaultValues(
          $a: Int = "one",
          $b: String = 4,
          $c: ComplexInput = "NotVeryComplex"
        ) {
          dog { name }
        }
      `).toDeepEqual([
        {
          message: 'Int cannot represent non-integer value: "one"',
          locations: [{ line: 3, column: 21 }],
        },
        {
          message: 'String cannot represent a non string value: 4',
          locations: [{ line: 4, column: 24 }],
        },
        {
          message:
            'Expected value of type "ComplexInput", found "NotVeryComplex".',
          locations: [{ line: 5, column: 30 }],
        },
      ]);
    });

    it('variables with complex invalid default values', () => {
      expectErrors(`
        query WithDefaultValues(
          $a: ComplexInput = { requiredField: 123, intField: "abc" }
        ) {
          dog { name }
        }
      `).toDeepEqual([
        {
          message: 'Boolean cannot represent a non boolean value: 123',
          locations: [{ line: 3, column: 47 }],
        },
        {
          message: 'Int cannot represent non-integer value: "abc"',
          locations: [{ line: 3, column: 62 }],
        },
      ]);
    });

    it('complex variables missing required field', () => {
      expectErrors(`
        query MissingRequiredField($a: ComplexInput = {intField: 3}) {
          dog { name }
        }
      `).toDeepEqual([
        {
          message:
            'Field "ComplexInput.requiredField" of required type "Boolean!" was not provided.',
          locations: [{ line: 2, column: 55 }],
        },
      ]);
    });

    it('list variables with invalid item', () => {
      expectErrors(`
        query InvalidItem($a: [String] = ["one", 2]) {
          dog { name }
        }
      `).toDeepEqual([
        {
          message: 'String cannot represent a non string value: 2',
          locations: [{ line: 2, column: 50 }],
        },
      ]);
    });
  });
});
