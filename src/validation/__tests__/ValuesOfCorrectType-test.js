/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectValidationErrors } from './harness';
import {
  ValuesOfCorrectType,
  badValueMessage,
  requiredFieldMessage,
  unknownFieldMessage,
} from '../rules/ValuesOfCorrectType';

function expectErrors(queryStr) {
  return expectValidationErrors(ValuesOfCorrectType, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

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
      `).to.deep.equal([badValue('String', '1', 4, 39)]);
    });

    it('Float into String', () => {
      expectErrors(`
        {
          complicatedArgs {
            stringArgField(stringArg: 1.0)
          }
        }
      `).to.deep.equal([badValue('String', '1.0', 4, 39)]);
    });

    it('Boolean into String', () => {
      expectErrors(`
        {
          complicatedArgs {
            stringArgField(stringArg: true)
          }
        }
      `).to.deep.equal([badValue('String', 'true', 4, 39)]);
    });

    it('Unquoted String into String', () => {
      expectErrors(`
        {
          complicatedArgs {
            stringArgField(stringArg: BAR)
          }
        }
      `).to.deep.equal([badValue('String', 'BAR', 4, 39)]);
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
      `).to.deep.equal([badValue('Int', '"3"', 4, 33)]);
    });

    it('Big Int into Int', () => {
      expectErrors(`
        {
          complicatedArgs {
            intArgField(intArg: 829384293849283498239482938)
          }
        }
      `).to.deep.equal([badValue('Int', '829384293849283498239482938', 4, 33)]);
    });

    it('Unquoted String into Int', () => {
      expectErrors(`
        {
          complicatedArgs {
            intArgField(intArg: FOO)
          }
        }
      `).to.deep.equal([badValue('Int', 'FOO', 4, 33)]);
    });

    it('Simple Float into Int', () => {
      expectErrors(`
        {
          complicatedArgs {
            intArgField(intArg: 3.0)
          }
        }
      `).to.deep.equal([badValue('Int', '3.0', 4, 33)]);
    });

    it('Float into Int', () => {
      expectErrors(`
        {
          complicatedArgs {
            intArgField(intArg: 3.333)
          }
        }
      `).to.deep.equal([badValue('Int', '3.333', 4, 33)]);
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
      `).to.deep.equal([badValue('Float', '"3.333"', 4, 37)]);
    });

    it('Boolean into Float', () => {
      expectErrors(`
        {
          complicatedArgs {
            floatArgField(floatArg: true)
          }
        }
      `).to.deep.equal([badValue('Float', 'true', 4, 37)]);
    });

    it('Unquoted into Float', () => {
      expectErrors(`
        {
          complicatedArgs {
            floatArgField(floatArg: FOO)
          }
        }
      `).to.deep.equal([badValue('Float', 'FOO', 4, 37)]);
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
      `).to.deep.equal([badValue('Boolean', '2', 4, 41)]);
    });

    it('Float into Boolean', () => {
      expectErrors(`
        {
          complicatedArgs {
            booleanArgField(booleanArg: 1.0)
          }
        }
      `).to.deep.equal([badValue('Boolean', '1.0', 4, 41)]);
    });

    it('String into Boolean', () => {
      expectErrors(`
        {
          complicatedArgs {
            booleanArgField(booleanArg: "true")
          }
        }
      `).to.deep.equal([badValue('Boolean', '"true"', 4, 41)]);
    });

    it('Unquoted into Boolean', () => {
      expectErrors(`
        {
          complicatedArgs {
            booleanArgField(booleanArg: TRUE)
          }
        }
      `).to.deep.equal([badValue('Boolean', 'TRUE', 4, 41)]);
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
      `).to.deep.equal([badValue('ID', '1.0', 4, 31)]);
    });

    it('Boolean into ID', () => {
      expectErrors(`
        {
          complicatedArgs {
            idArgField(idArg: true)
          }
        }
      `).to.deep.equal([badValue('ID', 'true', 4, 31)]);
    });

    it('Unquoted into ID', () => {
      expectErrors(`
        {
          complicatedArgs {
            idArgField(idArg: SOMETHING)
          }
        }
      `).to.deep.equal([badValue('ID', 'SOMETHING', 4, 31)]);
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
      `).to.deep.equal([badValue('DogCommand', '2', 4, 41)]);
    });

    it('Float into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: 1.0)
          }
        }
      `).to.deep.equal([badValue('DogCommand', '1.0', 4, 41)]);
    });

    it('String into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: "SIT")
          }
        }
      `).to.deep.equal([
        badValue(
          'DogCommand',
          '"SIT"',
          4,
          41,
          'Did you mean the enum value SIT?',
        ),
      ]);
    });

    it('Boolean into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: true)
          }
        }
      `).to.deep.equal([badValue('DogCommand', 'true', 4, 41)]);
    });

    it('Unknown Enum Value into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: JUGGLE)
          }
        }
      `).to.deep.equal([badValue('DogCommand', 'JUGGLE', 4, 41)]);
    });

    it('Different case Enum Value into Enum', () => {
      expectErrors(`
        {
          dog {
            doesKnowCommand(dogCommand: sit)
          }
        }
      `).to.deep.equal([
        badValue(
          'DogCommand',
          'sit',
          4,
          41,
          'Did you mean the enum value SIT?',
        ),
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
      `).to.deep.equal([badValue('String', '2', 4, 55)]);
    });

    it('Single value of incorrect type', () => {
      expectErrors(`
        {
          complicatedArgs {
            stringListArgField(stringListArg: 1)
          }
        }
      `).to.deep.equal([badValue('[String]', '1', 4, 47)]);
    });
  });

  describe('Valid non-nullable value', () => {
    it('Arg on optional arg', () => {
      expectValid(`
        {
          dog {
            isHousetrained(atOtherHomes: true)
          }
        }
      `);
    });

    it('No Arg on optional arg', () => {
      expectValid(`
        {
          dog {
            isHousetrained
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

    it('Multiple reqs on mixedList', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4)
          }
        }
      `);
    });

    it('Multiple reqs and one opt on mixedList', () => {
      expectValid(`
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5)
          }
        }
      `);
    });

    it('All reqs and opts on mixedList', () => {
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
      `).to.deep.equal([
        badValue('Int!', '"two"', 4, 32),
        badValue('Int!', '"one"', 4, 45),
      ]);
    });

    it('Incorrect value and missing argument (ProvidedRequiredArguments)', () => {
      expectErrors(`
        {
          complicatedArgs {
            multipleReqs(req1: "one")
          }
        }
      `).to.deep.equal([badValue('Int!', '"one"', 4, 32)]);
    });

    it('Null value', () => {
      expectErrors(`
        {
          complicatedArgs {
            multipleReqs(req1: null)
          }
        }
      `).to.deep.equal([badValue('Int!', 'null', 4, 32)]);
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

    it('Partial object, required field can be falsey', () => {
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
      `).to.deep.equal([
        requiredField('ComplexInput', 'requiredField', 'Boolean!', 4, 41),
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
      `).to.deep.equal([badValue('String', '2', 5, 40)]);
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
      `).to.deep.equal([badValue('Boolean!', 'null', 6, 29)]);
    });

    it('Partial object, unknown field arg', () => {
      expectErrors(`
        {
          complicatedArgs {
            complexArgField(complexArg: {
              requiredField: true,
              unknownField: "value"
            })
          }
        }
      `).to.deep.equal([
        unknownField(
          'ComplexInput',
          'unknownField',
          6,
          15,
          'Did you mean nonNullField, intField, or booleanField?',
        ),
      ]);
    });

    it('reports original error for custom scalar which throws', () => {
      const expectedErrors = expectErrors(`
        {
          invalidArg(arg: 123)
        }
      `);

      expectedErrors.to.deep.equal([
        badValue(
          'Invalid',
          '123',
          3,
          27,
          'Invalid scalar is always invalid: 123',
        ),
      ]);

      expectedErrors.to.have.nested.property(
        '[0].originalError.message',
        'Invalid scalar is always invalid: 123',
      );
    });

    it('allows custom scalar to accept complex literals', () => {
      expectValid(`
        {
          test1: anyArg(arg: 123)
          test2: anyArg(arg: "abc")
          test3: anyArg(arg: [123, "abc"])
          test4: anyArg(arg: {deep: [123, "abc"]})
        }
      `);
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
      `).to.deep.equal([
        badValue('Boolean!', '"yes"', 3, 28),
        badValue('Boolean!', 'ENUM', 4, 28),
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
      `).to.deep.equal([
        badValue('Int!', 'null', 3, 22),
        badValue('String!', 'null', 4, 25),
        badValue('Boolean!', 'null', 5, 47),
      ]);
    });

    it('variables with invalid default values', () => {
      expectErrors(`
        query InvalidDefaultValues(
          $a: Int = "one",
          $b: String = 4,
          $c: ComplexInput = "notverycomplex"
        ) {
          dog { name }
        }
      `).to.deep.equal([
        badValue('Int', '"one"', 3, 21),
        badValue('String', '4', 4, 24),
        badValue('ComplexInput', '"notverycomplex"', 5, 30),
      ]);
    });

    it('variables with complex invalid default values', () => {
      expectErrors(`
        query WithDefaultValues(
          $a: ComplexInput = { requiredField: 123, intField: "abc" }
        ) {
          dog { name }
        }
      `).to.deep.equal([
        badValue('Boolean!', '123', 3, 47),
        badValue('Int', '"abc"', 3, 62),
      ]);
    });

    it('complex variables missing required field', () => {
      expectErrors(`
        query MissingRequiredField($a: ComplexInput = {intField: 3}) {
          dog { name }
        }
      `).to.deep.equal([
        requiredField('ComplexInput', 'requiredField', 'Boolean!', 2, 55),
      ]);
    });

    it('list variables with invalid item', () => {
      expectErrors(`
        query InvalidItem($a: [String] = ["one", 2]) {
          dog { name }
        }
      `).to.deep.equal([badValue('String', '2', 2, 50)]);
    });
  });
});
