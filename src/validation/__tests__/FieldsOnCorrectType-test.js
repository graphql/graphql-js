/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  FieldsOnCorrectType,
  undefinedFieldMessage,
} from '../rules/FieldsOnCorrectType';


function undefinedField(field, type, suggestions, line, column) {
  return {
    message: undefinedFieldMessage(field, type, suggestions),
    locations: [ { line, column } ],
  };
}

describe('Validate: Fields on correct type', () => {

  it('Object field selection', () => {
    expectPassesRule(FieldsOnCorrectType, `
      fragment objectFieldSelection on Dog {
        __typename
        name
      }
    `);
  });

  it('Aliased object field selection', () => {
    expectPassesRule(FieldsOnCorrectType, `
      fragment aliasedObjectFieldSelection on Dog {
        tn : __typename
        otherName : name
      }
    `);
  });

  it('Interface field selection', () => {
    expectPassesRule(FieldsOnCorrectType, `
      fragment interfaceFieldSelection on Pet {
        __typename
        name
      }
    `);
  });

  it('Aliased interface field selection', () => {
    expectPassesRule(FieldsOnCorrectType, `
      fragment interfaceFieldSelection on Pet {
        otherName : name
      }
    `);
  });

  it('Lying alias selection', () => {
    expectPassesRule(FieldsOnCorrectType, `
      fragment lyingAliasSelection on Dog {
        name : nickname
      }
    `);
  });

  it('Ignores fields on unknown type', () => {
    expectPassesRule(FieldsOnCorrectType, `
      fragment unknownSelection on UnknownType {
        unknownField
      }
    `);
  });

  it('reports errors when type is known again', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment typeKnownAgain on Pet {
        unknown_pet_field {
          ... on Cat {
            unknown_cat_field
          }
        }
      }`,
      [ undefinedField('unknown_pet_field', 'Pet', [], 3, 9),
        undefinedField('unknown_cat_field', 'Cat', [], 5, 13) ]
    );
  });

  it('Field not defined on fragment', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment fieldNotDefined on Dog {
        meowVolume
      }`,
      [ undefinedField('meowVolume', 'Dog', [], 3, 9) ]
    );
  });

  it('Ignores deeply unknown field', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment deepFieldNotDefined on Dog {
        unknown_field {
          deeper_unknown_field
        }
      }`,
      [ undefinedField('unknown_field', 'Dog', [], 3, 9) ]
    );
  });

  it('Sub-field not defined', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment subFieldNotDefined on Human {
        pets {
          unknown_field
        }
      }`,
      [ undefinedField('unknown_field', 'Pet', [], 4, 11) ]
    );
  });

  it('Field not defined on inline fragment', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment fieldNotDefined on Pet {
        ... on Dog {
          meowVolume
        }
      }`,
      [ undefinedField('meowVolume', 'Dog', [], 4, 11) ]
    );
  });

  it('Aliased field target not defined', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment aliasedFieldTargetNotDefined on Dog {
        volume : mooVolume
      }`,
      [ undefinedField('mooVolume', 'Dog', [], 3, 9) ]
    );
  });

  it('Aliased lying field target not defined', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment aliasedLyingFieldTargetNotDefined on Dog {
        barkVolume : kawVolume
      }`,
      [ undefinedField('kawVolume', 'Dog', [], 3, 9) ]
    );
  });

  it('Not defined on interface', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment notDefinedOnInterface on Pet {
        tailLength
      }`,
      [ undefinedField('tailLength', 'Pet', [], 3, 9) ]
    );
  });

  it('Defined on implementors but not on interface', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment definedOnImplementorsButNotInterface on Pet {
        nickname
      }`,
      [ undefinedField('nickname', 'Pet', [ 'Cat', 'Dog' ], 3, 9) ]
    );
  });

  it('Meta field selection on union', () => {
    expectPassesRule(FieldsOnCorrectType, `
      fragment directFieldSelectionOnUnion on CatOrDog {
        __typename
      }`
    );
  });

  it('Direct field selection on union', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment directFieldSelectionOnUnion on CatOrDog {
        directField
      }`,
      [ undefinedField('directField', 'CatOrDog', [], 3, 9) ]
    );
  });

  it('Defined on implementors queried on union', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment definedOnImplementorsQueriedOnUnion on CatOrDog {
        name
      }`,
      [
        undefinedField(
          'name',
          'CatOrDog',
          [ 'Being', 'Pet', 'Canine', 'Cat', 'Dog' ],
          3,
          9
        )
      ]
    );
  });

  it('valid field in inline fragment', () => {
    expectPassesRule(FieldsOnCorrectType, `
      fragment objectFieldSelection on Pet {
        ... on Dog {
          name
        }
        ... {
          name
        }
      }
    `);
  });

  describe('Fields on correct type error message', () => {
    it('Works with no suggestions', () => {
      expect(
        undefinedFieldMessage('T', 'f', [])
      ).to.equal('Cannot query field "T" on type "f".');
    });

    it('Works with no small numbers of suggestions', () => {
      expect(
        undefinedFieldMessage('T', 'f', [ 'A', 'B' ])
      ).to.equal('Cannot query field "T" on type "f". ' +
        'However, this field exists on "A", "B". ' +
        'Perhaps you meant to use an inline fragment?');
    });

    it('Works with lots of suggestions', () => {
      expect(
        undefinedFieldMessage('T', 'f', [ 'A', 'B', 'C', 'D', 'E', 'F' ])
      ).to.equal('Cannot query field "T" on type "f". ' +
        'However, this field exists on "A", "B", "C", "D", "E", ' +
        'and 1 other types. ' +
        'Perhaps you meant to use an inline fragment?');
    });
  });
});

