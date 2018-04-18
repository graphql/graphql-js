/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  ValuesOfCorrectType,
  badValueMessage,
  requiredFieldMessage,
  unknownFieldMessage,
} from '../rules/ValuesOfCorrectType';

function badValue(typeName, value, line, column, message) {
  return {
    message: badValueMessage(typeName, value, message),
    locations: [{ line, column }],
  };
}

function requiredField(typeName, fieldName, fieldTypeName, line, column) {
  return {
    message: requiredFieldMessage(typeName, fieldName, fieldTypeName),
    locations: [{ line, column }],
  };
}

function unknownField(typeName, fieldName, line, column, message) {
  return {
    message: unknownFieldMessage(typeName, fieldName, message),
    locations: [{ line, column }],
  };
}

describe('Validate: Values of correct type', () => {
  describe('Valid values', () => {
    it('Good int value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            intArgField(intArg: 2)
          }
        }
      `,
      );
    });

    it('Good negative int value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            intArgField(intArg: -2)
          }
        }
      `,
      );
    });

    it('Good boolean value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            booleanArgField(booleanArg: true)
          }
        }
      `,
      );
    });

    it('Good string value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringArgField(stringArg: "foo")
          }
        }
      `,
      );
    });

    it('Good float value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            floatArgField(floatArg: 1.1)
          }
        }
      `,
      );
    });

    it('Good negative float value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            floatArgField(floatArg: -1.1)
          }
        }
      `,
      );
    });

    it('Int into Float', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            floatArgField(floatArg: 1)
          }
        }
      `,
      );
    });

    it('Int into ID', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            idArgField(idArg: 1)
          }
        }
      `,
      );
    });

    it('String into ID', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            idArgField(idArg: "someIdString")
          }
        }
      `,
      );
    });

    it('Good enum value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          dog {
            doesKnowCommand(dogCommand: SIT)
          }
        }
      `,
      );
    });

    it('Enum with undefined value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            enumArgField(enumArg: UNKNOWN)
          }
        }
      `,
      );
    });

    it('Enum with null value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            enumArgField(enumArg: NO_FUR)
          }
        }
      `,
      );
    });

    it('null into nullable type', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            intArgField(intArg: null)
          }
        }
      `,
      );

      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          dog(a: null, b: null, c:{ requiredField: true, intField: null }) {
            name
          }
        }
      `,
      );
    });
  });

  describe('Invalid String values', () => {
    it('Int into String', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringArgField(stringArg: 1)
          }
        }
      `,
        [badValue('String', '1', 4, 39)],
      );
    });

    it('Float into String', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringArgField(stringArg: 1.0)
          }
        }
      `,
        [badValue('String', '1.0', 4, 39)],
      );
    });

    it('Boolean into String', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringArgField(stringArg: true)
          }
        }
      `,
        [badValue('String', 'true', 4, 39)],
      );
    });

    it('Unquoted String into String', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringArgField(stringArg: BAR)
          }
        }
      `,
        [badValue('String', 'BAR', 4, 39)],
      );
    });
  });

  describe('Invalid Int values', () => {
    it('String into Int', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            intArgField(intArg: "3")
          }
        }
      `,
        [badValue('Int', '"3"', 4, 33)],
      );
    });

    it('Big Int into Int', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            intArgField(intArg: 829384293849283498239482938)
          }
        }
      `,
        [badValue('Int', '829384293849283498239482938', 4, 33)],
      );
    });

    it('Unquoted String into Int', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            intArgField(intArg: FOO)
          }
        }
      `,
        [badValue('Int', 'FOO', 4, 33)],
      );
    });

    it('Simple Float into Int', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            intArgField(intArg: 3.0)
          }
        }
      `,
        [badValue('Int', '3.0', 4, 33)],
      );
    });

    it('Float into Int', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            intArgField(intArg: 3.333)
          }
        }
      `,
        [badValue('Int', '3.333', 4, 33)],
      );
    });
  });

  describe('Invalid Float values', () => {
    it('String into Float', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            floatArgField(floatArg: "3.333")
          }
        }
      `,
        [badValue('Float', '"3.333"', 4, 37)],
      );
    });

    it('Boolean into Float', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            floatArgField(floatArg: true)
          }
        }
      `,
        [badValue('Float', 'true', 4, 37)],
      );
    });

    it('Unquoted into Float', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            floatArgField(floatArg: FOO)
          }
        }
      `,
        [badValue('Float', 'FOO', 4, 37)],
      );
    });
  });

  describe('Invalid Boolean value', () => {
    it('Int into Boolean', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            booleanArgField(booleanArg: 2)
          }
        }
      `,
        [badValue('Boolean', '2', 4, 41)],
      );
    });

    it('Float into Boolean', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            booleanArgField(booleanArg: 1.0)
          }
        }
      `,
        [badValue('Boolean', '1.0', 4, 41)],
      );
    });

    it('String into Boolean', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            booleanArgField(booleanArg: "true")
          }
        }
      `,
        [badValue('Boolean', '"true"', 4, 41)],
      );
    });

    it('Unquoted into Boolean', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            booleanArgField(booleanArg: TRUE)
          }
        }
      `,
        [badValue('Boolean', 'TRUE', 4, 41)],
      );
    });
  });

  describe('Invalid ID value', () => {
    it('Float into ID', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            idArgField(idArg: 1.0)
          }
        }
      `,
        [badValue('ID', '1.0', 4, 31)],
      );
    });

    it('Boolean into ID', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            idArgField(idArg: true)
          }
        }
      `,
        [badValue('ID', 'true', 4, 31)],
      );
    });

    it('Unquoted into ID', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            idArgField(idArg: SOMETHING)
          }
        }
      `,
        [badValue('ID', 'SOMETHING', 4, 31)],
      );
    });
  });

  describe('Invalid Enum value', () => {
    it('Int into Enum', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          dog {
            doesKnowCommand(dogCommand: 2)
          }
        }
      `,
        [badValue('DogCommand', '2', 4, 41)],
      );
    });

    it('Float into Enum', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          dog {
            doesKnowCommand(dogCommand: 1.0)
          }
        }
      `,
        [badValue('DogCommand', '1.0', 4, 41)],
      );
    });

    it('String into Enum', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          dog {
            doesKnowCommand(dogCommand: "SIT")
          }
        }
      `,
        [
          badValue(
            'DogCommand',
            '"SIT"',
            4,
            41,
            'Did you mean the enum value SIT?',
          ),
        ],
      );
    });

    it('Boolean into Enum', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          dog {
            doesKnowCommand(dogCommand: true)
          }
        }
      `,
        [badValue('DogCommand', 'true', 4, 41)],
      );
    });

    it('Unknown Enum Value into Enum', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          dog {
            doesKnowCommand(dogCommand: JUGGLE)
          }
        }
      `,
        [badValue('DogCommand', 'JUGGLE', 4, 41)],
      );
    });

    it('Different case Enum Value into Enum', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          dog {
            doesKnowCommand(dogCommand: sit)
          }
        }
      `,
        [
          badValue(
            'DogCommand',
            'sit',
            4,
            41,
            'Did you mean the enum value SIT?',
          ),
        ],
      );
    });
  });

  describe('Valid List value', () => {
    it('Good list value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringListArgField(stringListArg: ["one", null, "two"])
          }
        }
      `,
      );
    });

    it('Empty list value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringListArgField(stringListArg: [])
          }
        }
      `,
      );
    });

    it('Null value', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringListArgField(stringListArg: null)
          }
        }
      `,
      );
    });

    it('Single value into List', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringListArgField(stringListArg: "one")
          }
        }
      `,
      );
    });
  });

  describe('Invalid List value', () => {
    it('Incorrect item type', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringListArgField(stringListArg: ["one", 2])
          }
        }
      `,
        [badValue('String', '2', 4, 55)],
      );
    });

    it('Single value of incorrect type', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            stringListArgField(stringListArg: 1)
          }
        }
      `,
        [badValue('[String]', '1', 4, 47)],
      );
    });
  });

  describe('Valid non-nullable value', () => {
    it('Arg on optional arg', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          dog {
            isHousetrained(atOtherHomes: true)
          }
        }
      `,
      );
    });

    it('No Arg on optional arg', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          dog {
            isHousetrained
          }
        }
      `,
      );
    });

    it('Multiple args', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleReqs(req1: 1, req2: 2)
          }
        }
      `,
      );
    });

    it('Multiple args reverse order', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleReqs(req2: 2, req1: 1)
          }
        }
      `,
      );
    });

    it('No args on multiple optional', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleOpts
          }
        }
      `,
      );
    });

    it('One arg on multiple optional', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleOpts(opt1: 1)
          }
        }
      `,
      );
    });

    it('Second arg on multiple optional', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleOpts(opt2: 1)
          }
        }
      `,
      );
    });

    it('Multiple reqs on mixedList', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4)
          }
        }
      `,
      );
    });

    it('Multiple reqs and one opt on mixedList', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5)
          }
        }
      `,
      );
    });

    it('All reqs and opts on mixedList', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5, opt2: 6)
          }
        }
      `,
      );
    });
  });

  describe('Invalid non-nullable value', () => {
    it('Incorrect value type', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleReqs(req2: "two", req1: "one")
          }
        }
      `,
        [badValue('Int!', '"two"', 4, 32), badValue('Int!', '"one"', 4, 45)],
      );
    });

    it('Incorrect value and missing argument (ProvidedRequiredArguments)', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleReqs(req1: "one")
          }
        }
      `,
        [badValue('Int!', '"one"', 4, 32)],
      );
    });

    it('Null value', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            multipleReqs(req1: null)
          }
        }
      `,
        [badValue('Int!', 'null', 4, 32)],
      );
    });
  });

  describe('Valid input object value', () => {
    it('Optional arg, despite required field in type', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            complexArgField
          }
        }
      `,
      );
    });

    it('Partial object, only required', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            complexArgField(complexArg: { requiredField: true })
          }
        }
      `,
      );
    });

    it('Partial object, required field can be falsey', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            complexArgField(complexArg: { requiredField: false })
          }
        }
      `,
      );
    });

    it('Partial object, including required', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            complexArgField(complexArg: { requiredField: true, intField: 4 })
          }
        }
      `,
      );
    });

    it('Full object', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
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
      `,
      );
    });

    it('Full object with fields in different order', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
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
      `,
      );
    });
  });

  describe('Invalid input object value', () => {
    it('Partial object, missing required', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            complexArgField(complexArg: { intField: 4 })
          }
        }
      `,
        [requiredField('ComplexInput', 'requiredField', 'Boolean!', 4, 41)],
      );
    });

    it('Partial object, invalid field type', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            complexArgField(complexArg: {
              stringListField: ["one", 2],
              requiredField: true,
            })
          }
        }
      `,
        [badValue('String', '2', 5, 40)],
      );
    });

    it('Partial object, null to non-null field', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            complexArgField(complexArg: {
              requiredField: true,
              nonNullField: null,
            })
          }
        }
      `,
        [badValue('Boolean!', 'null', 6, 29)],
      );
    });

    it('Partial object, unknown field arg', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          complicatedArgs {
            complexArgField(complexArg: {
              requiredField: true,
              unknownField: "value"
            })
          }
        }
      `,
        [
          unknownField(
            'ComplexInput',
            'unknownField',
            6,
            15,
            'Did you mean nonNullField, intField, or booleanField?',
          ),
        ],
      );
    });

    it('reports original error for custom scalar which throws', () => {
      const errors = expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          invalidArg(arg: 123)
        }
      `,
        [
          badValue(
            'Invalid',
            '123',
            3,
            27,
            'Invalid scalar is always invalid: 123',
          ),
        ],
      );
      expect(errors[0].originalError.message).to.equal(
        'Invalid scalar is always invalid: 123',
      );
    });

    it('allows custom scalar to accept complex literals', () => {
      expectPassesRule(
        ValuesOfCorrectType,
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
      expectPassesRule(
        ValuesOfCorrectType,
        `
        {
          dog @include(if: true) {
            name
          }
          human @skip(if: false) {
            name
          }
        }
      `,
      );
    });

    it('with directive with incorrect types', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        {
          dog @include(if: "yes") {
            name @skip(if: ENUM)
          }
        }
      `,
        [
          badValue('Boolean!', '"yes"', 3, 28),
          badValue('Boolean!', 'ENUM', 4, 28),
        ],
      );
    });
  });

  describe('Variable default values', () => {
    it('variables with valid default values', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        query WithDefaultValues(
          $a: Int = 1,
          $b: String = "ok",
          $c: ComplexInput = { requiredField: true, intField: 3 }
          $d: Int! = 123
        ) {
          dog { name }
        }
      `,
      );
    });

    it('variables with valid default null values', () => {
      expectPassesRule(
        ValuesOfCorrectType,
        `
        query WithDefaultValues(
          $a: Int = null,
          $b: String = null,
          $c: ComplexInput = { requiredField: true, intField: null }
        ) {
          dog { name }
        }
      `,
      );
    });

    it('variables with invalid default null values', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        query WithDefaultValues(
          $a: Int! = null,
          $b: String! = null,
          $c: ComplexInput = { requiredField: null, intField: null }
        ) {
          dog { name }
        }
      `,
        [
          badValue('Int!', 'null', 3, 22),
          badValue('String!', 'null', 4, 25),
          badValue('Boolean!', 'null', 5, 47),
        ],
      );
    });

    it('variables with invalid default values', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        query InvalidDefaultValues(
          $a: Int = "one",
          $b: String = 4,
          $c: ComplexInput = "notverycomplex"
        ) {
          dog { name }
        }
      `,
        [
          badValue('Int', '"one"', 3, 21),
          badValue('String', '4', 4, 24),
          badValue('ComplexInput', '"notverycomplex"', 5, 30),
        ],
      );
    });

    it('variables with complex invalid default values', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        query WithDefaultValues(
          $a: ComplexInput = { requiredField: 123, intField: "abc" }
        ) {
          dog { name }
        }
      `,
        [badValue('Boolean!', '123', 3, 47), badValue('Int', '"abc"', 3, 62)],
      );
    });

    it('complex variables missing required field', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        query MissingRequiredField($a: ComplexInput = {intField: 3}) {
          dog { name }
        }
      `,
        [requiredField('ComplexInput', 'requiredField', 'Boolean!', 2, 55)],
      );
    });

    it('list variables with invalid item', () => {
      expectFailsRule(
        ValuesOfCorrectType,
        `
        query InvalidItem($a: [String] = ["one", 2]) {
          dog { name }
        }
      `,
        [badValue('String', '2', 2, 50)],
      );
    });
  });
});
