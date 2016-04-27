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


function undefinedField(
  field,
  type,
  suggestedTypes,
  suggestedFields,
  line,
  column
) {
  return {
    message: undefinedFieldMessage(
      field,
      type,
      suggestedTypes,
      suggestedFields
    ),
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
      [ undefinedField('unknown_pet_field', 'Pet', [], [], 3, 9),
        undefinedField(
          'unknown_cat_field',
          'Cat',
          [],
          [],
          5,
          13
        )
      ]
    );
  });

  it('Field not defined on fragment', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment fieldNotDefined on Dog {
        meowVolume
      }`,
      [ undefinedField(
          'meowVolume',
          'Dog',
          [],
          [ 'barkVolume' ],
          3,
          9
        )
      ]
    );
  });

  it('Ignores deeply unknown field', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment deepFieldNotDefined on Dog {
        unknown_field {
          deeper_unknown_field
        }
      }`,
      [ undefinedField(
          'unknown_field',
          'Dog',
          [],
          [],
          3,
          9
        )
      ]
    );
  });

  it('Sub-field not defined', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment subFieldNotDefined on Human {
        pets {
          unknown_field
        }
      }`,
      [ undefinedField('unknown_field', 'Pet', [], [], 4, 11) ]
    );
  });

  it('Field not defined on inline fragment', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment fieldNotDefined on Pet {
        ... on Dog {
          meowVolume
        }
      }`,
      [ undefinedField(
          'meowVolume',
          'Dog',
          [],
          [ 'barkVolume' ],
          4,
          11
        )
      ]
    );
  });

  it('Aliased field target not defined', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment aliasedFieldTargetNotDefined on Dog {
        volume : mooVolume
      }`,
      [ undefinedField(
          'mooVolume',
          'Dog',
          [],
          [ 'barkVolume' ],
          3,
          9
        )
      ]
    );
  });

  it('Aliased lying field target not defined', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment aliasedLyingFieldTargetNotDefined on Dog {
        barkVolume : kawVolume
      }`,
      [ undefinedField(
          'kawVolume',
          'Dog',
          [],
          [ 'barkVolume' ],
          3,
          9
        )
      ]
    );
  });

  it('Not defined on interface', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment notDefinedOnInterface on Pet {
        tailLength
      }`,
      [ undefinedField('tailLength', 'Pet', [], [], 3, 9) ]
    );
  });

  it('Defined on implementors but not on interface', () => {
    expectFailsRule(FieldsOnCorrectType, `
      fragment definedOnImplementorsButNotInterface on Pet {
        nickname
      }`,
      [ undefinedField('nickname', 'Pet', [ 'Dog', 'Cat' ], [ 'name' ], 3, 9) ]
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
      [ undefinedField('directField', 'CatOrDog', [], [], 3, 9) ]
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
          [ 'Being', 'Pet', 'Canine', 'Dog', 'Cat' ],
          [],
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
        undefinedFieldMessage('f', 'T', [], [])
      ).to.equal(
        'Cannot query field "f" on type "T".'
      );
    });

    it('Works with no small numbers of type suggestions', () => {
      expect(
        undefinedFieldMessage('f', 'T', [ 'A', 'B' ], [])
      ).to.equal(
        'Cannot query field "f" on type "T". ' +
        'Did you mean to use an inline fragment on "A" or "B"?'
      );
    });

    it('Works with no small numbers of field suggestions', () => {
      expect(
        undefinedFieldMessage('f', 'T', [], [ 'z', 'y' ])
      ).to.equal(
        'Cannot query field "f" on type "T". ' +
        'Did you mean "z" or "y"?'
      );
    });

    it('Only shows one set of suggestions at a time, preferring types', () => {
      expect(
        undefinedFieldMessage('f', 'T', [ 'A', 'B' ], [ 'z', 'y' ])
      ).to.equal(
        'Cannot query field "f" on type "T". ' +
        'Did you mean to use an inline fragment on "A" or "B"?'
      );
    });

    it('Limits lots of type suggestions', () => {
      expect(
        undefinedFieldMessage('f', 'T', [ 'A', 'B', 'C', 'D', 'E', 'F' ], [])
      ).to.equal(
        'Cannot query field "f" on type "T". ' +
        'Did you mean to use an inline fragment on "A", "B", "C", "D", or "E"?'
      );
    });

    it('Limits lots of field suggestions', () => {
      expect(
        undefinedFieldMessage('f', 'T', [], [ 'z', 'y', 'x', 'w', 'v', 'u' ])
      ).to.equal(
        'Cannot query field "f" on type "T". ' +
        'Did you mean "z", "y", "x", "w", or "v"?'
      );
    });

  });
});

