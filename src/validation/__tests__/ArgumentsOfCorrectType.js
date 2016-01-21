/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  ArgumentsOfCorrectType,
  badValueMessage
} from '../rules/ArgumentsOfCorrectType';


function badValue(argName, typeName, value, line, column, errors) {
  let realErrors;
  if (!errors) {
    realErrors = [
      `Expected type "${typeName}", found ${value}.`
    ];
  } else {
    realErrors = errors;
  }
  return {
    message: badValueMessage(argName, typeName, value, realErrors),
    locations: [ { line, column } ],
  };
}


describe('Validate: Argument values of correct type', () => {

  describe('Valid values', () => {

    it('Good int value', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            intArgField(intArg: 2)
          }
        }
      `);
    });

    it('Good boolean value', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            booleanArgField(booleanArg: true)
          }
        }
      `);
    });

    it('Good string value', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            stringArgField(stringArg: "foo")
          }
        }
      `);
    });

    it('Good float value', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            floatArgField(floatArg: 1.1)
          }
        }
      `);
    });

    it('Int into Float', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            floatArgField(floatArg: 1)
          }
        }
      `);
    });

    it('Int into ID', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            idArgField(idArg: 1)
          }
        }
      `);
    });

    it('String into ID', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            idArgField(idArg: "someIdString")
          }
        }
      `);
    });

    it('Good enum value', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          dog {
            doesKnowCommand(dogCommand: SIT)
          }
        }
      `);
    });

  });


  describe('Invalid String values', () => {

    it('Int into String', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            stringArgField(stringArg: 1)
          }
        }
      `, [
        badValue('stringArg', 'String', '1', 4, 39)
      ]);
    });

    it('Float into String', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            stringArgField(stringArg: 1.0)
          }
        }
      `, [
        badValue('stringArg', 'String', '1.0', 4, 39)
      ]);
    });

    it('Boolean into String', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            stringArgField(stringArg: true)
          }
        }
      `, [
        badValue('stringArg', 'String', 'true', 4, 39)
      ]);
    });

    it('Unquoted String into String', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            stringArgField(stringArg: BAR)
          }
        }
      `, [
        badValue('stringArg', 'String', 'BAR', 4, 39)
      ]);
    });

  });


  describe('Invalid Int values', () => {

    it('String into Int', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            intArgField(intArg: "3")
          }
        }
      `, [
        badValue('intArg', 'Int', '"3"', 4, 33)
      ]);
    });

    it('Big Int into Int', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            intArgField(intArg: 829384293849283498239482938)
          }
        }
      `, [
        badValue('intArg', 'Int', '829384293849283498239482938', 4, 33)
      ]);
    });

    it('Unquoted String into Int', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            intArgField(intArg: FOO)
          }
        }
      `, [
        badValue('intArg', 'Int', 'FOO', 4, 33)
      ]);
    });

    it('Simple Float into Int', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            intArgField(intArg: 3.0)
          }
        }
      `, [
        badValue('intArg', 'Int', '3.0', 4, 33)
      ]);
    });

    it('Float into Int', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            intArgField(intArg: 3.333)
          }
        }
      `, [
        badValue('intArg', 'Int', '3.333', 4, 33)
      ]);
    });

  });


  describe('Invalid Float values', () => {

    it('String into Float', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            floatArgField(floatArg: "3.333")
          }
        }
      `, [
        badValue('floatArg', 'Float', '"3.333"', 4, 37)
      ]);
    });

    it('Boolean into Float', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            floatArgField(floatArg: true)
          }
        }
      `, [
        badValue('floatArg', 'Float', 'true', 4, 37)
      ]);
    });

    it('Unquoted into Float', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            floatArgField(floatArg: FOO)
          }
        }
      `, [
        badValue('floatArg', 'Float', 'FOO', 4, 37)
      ]);
    });

  });


  describe('Invalid Boolean value', () => {

    it('Int into Boolean', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            booleanArgField(booleanArg: 2)
          }
        }
      `, [
        badValue('booleanArg', 'Boolean', '2', 4, 41)
      ]);
    });

    it('Float into Boolean', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            booleanArgField(booleanArg: 1.0)
          }
        }
      `, [
        badValue('booleanArg', 'Boolean', '1.0', 4, 41)
      ]);
    });

    it('String into Boolean', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            booleanArgField(booleanArg: "true")
          }
        }
      `, [
        badValue('booleanArg', 'Boolean', '"true"', 4, 41)
      ]);
    });

    it('Unquoted into Boolean', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            booleanArgField(booleanArg: TRUE)
          }
        }
      `, [
        badValue('booleanArg', 'Boolean', 'TRUE', 4, 41)
      ]);
    });

  });


  describe('Invalid ID value', () => {

    it('Float into ID', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            idArgField(idArg: 1.0)
          }
        }
      `, [
        badValue('idArg', 'ID', '1.0', 4, 31)
      ]);
    });

    it('Boolean into ID', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            idArgField(idArg: true)
          }
        }
      `, [
        badValue('idArg', 'ID', 'true', 4, 31)
      ]);
    });

    it('Unquoted into ID', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            idArgField(idArg: SOMETHING)
          }
        }
      `, [
        badValue('idArg', 'ID', 'SOMETHING', 4, 31)
      ]);
    });

  });


  describe('Invalid Enum value', () => {

    it('Int into Enum', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          dog {
            doesKnowCommand(dogCommand: 2)
          }
        }
      `, [
        badValue('dogCommand', 'DogCommand', '2', 4, 41)
      ]);
    });

    it('Float into Enum', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          dog {
            doesKnowCommand(dogCommand: 1.0)
          }
        }
      `, [
        badValue('dogCommand', 'DogCommand', '1.0', 4, 41)
      ]);
    });

    it('String into Enum', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          dog {
            doesKnowCommand(dogCommand: "SIT")
          }
        }
      `, [
        badValue('dogCommand', 'DogCommand', '"SIT"', 4, 41)
      ]);
    });

    it('Boolean into Enum', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          dog {
            doesKnowCommand(dogCommand: true)
          }
        }
      `, [
        badValue('dogCommand', 'DogCommand', 'true', 4, 41)
      ]);
    });

    it('Unknown Enum Value into Enum', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          dog {
            doesKnowCommand(dogCommand: JUGGLE)
          }
        }
      `, [
        badValue('dogCommand', 'DogCommand', 'JUGGLE', 4, 41)
      ]);
    });

    it('Different case Enum Value into Enum', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          dog {
            doesKnowCommand(dogCommand: sit)
          }
        }
      `, [
        badValue('dogCommand', 'DogCommand', 'sit', 4, 41)
      ]);
    });

  });


  describe('Valid List value', () => {

    it('Good list value', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            stringListArgField(stringListArg: ["one", "two"])
          }
        }
      `);
    });

    it('Empty list value', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            stringListArgField(stringListArg: [])
          }
        }
      `);
    });

    it('Single value into List', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
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
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            stringListArgField(stringListArg: ["one", 2])
          }
        }
      `, [
        badValue('stringListArg', '[String]', '["one", 2]', 4, 47, [
          'In element #1: Expected type "String", found 2.'
        ]),
      ]);
    });

    it('Single value of incorrect type', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            stringListArgField(stringListArg: 1)
          }
        }
      `, [
        badValue('stringListArg', 'String', '1', 4, 47),
      ]);
    });

  });


  describe('Valid non-nullable value', () => {

    it('Arg on optional arg', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          dog {
            isHousetrained(atOtherHomes: true)
          }
        }
      `);
    });

    it('No Arg on optional arg', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          dog {
            isHousetrained
          }
        }
      `);
    });

    it('Multiple args', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            multipleReqs(req1: 1, req2: 2)
          }
        }
      `);
    });

    it('Multiple args reverse order', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            multipleReqs(req2: 2, req1: 1)
          }
        }
      `);
    });

    it('No args on multiple optional', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            multipleOpts
          }
        }
      `);
    });

    it('One arg on multiple optional', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            multipleOpts(opt1: 1)
          }
        }
      `);
    });

    it('Second arg on multiple optional', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            multipleOpts(opt2: 1)
          }
        }
      `);
    });

    it('Multiple reqs on mixedList', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4)
          }
        }
      `);
    });

    it('Multiple reqs and one opt on mixedList', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            multipleOptAndReq(req1: 3, req2: 4, opt1: 5)
          }
        }
      `);
    });

    it('All reqs and opts on mixedList', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
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
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            multipleReqs(req2: "two", req1: "one")
          }
        }
      `, [
        badValue('req2', 'Int', '"two"', 4, 32),
        badValue('req1', 'Int', '"one"', 4, 45),
      ]);
    });

    it('Incorrect value and missing argument', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            multipleReqs(req1: "one")
          }
        }
      `, [
        badValue('req1', 'Int', '"one"', 4, 32),
      ]);
    });

  });


  describe('Valid input object value', () => {

    it('Optional arg, despite required field in type', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            complexArgField
          }
        }
      `);
    });

    it('Partial object, only required', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            complexArgField(complexArg: { requiredField: true })
          }
        }
      `);
    });

    it('Partial object, required field can be falsey', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            complexArgField(complexArg: { requiredField: false })
          }
        }
      `);
    });

    it('Partial object, including required', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            complexArgField(complexArg: { requiredField: true, intField: 4 })
          }
        }
      `);
    });

    it('Full object', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
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
      expectPassesRule(ArgumentsOfCorrectType, `
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
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            complexArgField(complexArg: { intField: 4 })
          }
        }
      `, [
        badValue('complexArg', 'ComplexInput', '{intField: 4}', 4, 41, [
          'In field "requiredField": Expected "Boolean!", found null.'
        ]),
      ]);
    });

    it('Partial object, invalid field type', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            complexArgField(complexArg: {
              stringListField: ["one", 2],
              requiredField: true,
            })
          }
        }
      `, [
        badValue(
          'complexArg',
          'ComplexInput',
          '{stringListField: ["one", 2], requiredField: true}',
          4,
          41,
          [ 'In field "stringListField": In element #1: ' +
            'Expected type "String", found 2.' ]
        ),
      ]);
    });

    it('Partial object, unknown field arg', () => {
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          complicatedArgs {
            complexArgField(complexArg: {
              requiredField: true,
              unknownField: "value"
            })
          }
        }
      `, [
        badValue(
          'complexArg',
          'ComplexInput',
          '{requiredField: true, unknownField: "value"}',
          4,
          41,
          [ 'In field "unknownField": Unknown field.' ]
        ),
      ]);
    });

  });

  describe('Directive arguments', () => {

    it('with directives of valid types', () => {
      expectPassesRule(ArgumentsOfCorrectType, `
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
      expectFailsRule(ArgumentsOfCorrectType, `
        {
          dog @include(if: "yes") {
            name @skip(if: ENUM)
          }
        }
      `, [
        badValue('if', 'Boolean', '"yes"', 3, 28),
        badValue('if', 'Boolean', 'ENUM', 4, 28),
      ]);
    });

  });

});
