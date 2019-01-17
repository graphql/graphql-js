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
import { expectValidationErrors } from './harness';
import {
  FieldsOnCorrectType,
  undefinedFieldMessage,
} from '../rules/FieldsOnCorrectType';

function expectErrors(queryStr) {
  return expectValidationErrors(FieldsOnCorrectType, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function undefinedField(
  field,
  type,
  suggestedTypes,
  suggestedFields,
  line,
  column,
) {
  return {
    message: undefinedFieldMessage(
      field,
      type,
      suggestedTypes,
      suggestedFields,
    ),
    locations: [{ line, column }],
  };
}

describe('Validate: Fields on correct type', () => {
  it('Object field selection', () => {
    expectValid(`
      fragment objectFieldSelection on Dog {
        __typename
        name
      }
    `);
  });

  it('Aliased object field selection', () => {
    expectValid(`
      fragment aliasedObjectFieldSelection on Dog {
        tn : __typename
        otherName : name
      }
    `);
  });

  it('Interface field selection', () => {
    expectValid(`
      fragment interfaceFieldSelection on Pet {
        __typename
        name
      }
    `);
  });

  it('Aliased interface field selection', () => {
    expectValid(`
      fragment interfaceFieldSelection on Pet {
        otherName : name
      }
    `);
  });

  it('Lying alias selection', () => {
    expectValid(`
      fragment lyingAliasSelection on Dog {
        name : nickname
      }
    `);
  });

  it('Ignores fields on unknown type', () => {
    expectValid(`
      fragment unknownSelection on UnknownType {
        unknownField
      }
    `);
  });

  it('reports errors when type is known again', () => {
    expectErrors(`
      fragment typeKnownAgain on Pet {
        unknown_pet_field {
          ... on Cat {
            unknown_cat_field
          }
        }
      }
    `).to.deep.equal([
      undefinedField('unknown_pet_field', 'Pet', [], [], 3, 9),
      undefinedField('unknown_cat_field', 'Cat', [], [], 5, 13),
    ]);
  });

  it('Field not defined on fragment', () => {
    expectErrors(`
      fragment fieldNotDefined on Dog {
        meowVolume
      }
    `).to.deep.equal([
      undefinedField('meowVolume', 'Dog', [], ['barkVolume'], 3, 9),
    ]);
  });

  it('Ignores deeply unknown field', () => {
    expectErrors(`
      fragment deepFieldNotDefined on Dog {
        unknown_field {
          deeper_unknown_field
        }
      }
    `).to.deep.equal([undefinedField('unknown_field', 'Dog', [], [], 3, 9)]);
  });

  it('Sub-field not defined', () => {
    expectErrors(`
      fragment subFieldNotDefined on Human {
        pets {
          unknown_field
        }
      }
    `).to.deep.equal([undefinedField('unknown_field', 'Pet', [], [], 4, 11)]);
  });

  it('Field not defined on inline fragment', () => {
    expectErrors(`
      fragment fieldNotDefined on Pet {
        ... on Dog {
          meowVolume
        }
      }
    `).to.deep.equal([
      undefinedField('meowVolume', 'Dog', [], ['barkVolume'], 4, 11),
    ]);
  });

  it('Aliased field target not defined', () => {
    expectErrors(`
      fragment aliasedFieldTargetNotDefined on Dog {
        volume : mooVolume
      }
    `).to.deep.equal([
      undefinedField('mooVolume', 'Dog', [], ['barkVolume'], 3, 9),
    ]);
  });

  it('Aliased lying field target not defined', () => {
    expectErrors(`
      fragment aliasedLyingFieldTargetNotDefined on Dog {
        barkVolume : kawVolume
      }
    `).to.deep.equal([
      undefinedField('kawVolume', 'Dog', [], ['barkVolume'], 3, 9),
    ]);
  });

  it('Not defined on interface', () => {
    expectErrors(`
      fragment notDefinedOnInterface on Pet {
        tailLength
      }
    `).to.deep.equal([undefinedField('tailLength', 'Pet', [], [], 3, 9)]);
  });

  it('Defined on implementors but not on interface', () => {
    expectErrors(`
      fragment definedOnImplementorsButNotInterface on Pet {
        nickname
      }
    `).to.deep.equal([
      undefinedField('nickname', 'Pet', ['Dog', 'Cat'], ['name'], 3, 9),
    ]);
  });

  it('Meta field selection on union', () => {
    expectValid(`
      fragment directFieldSelectionOnUnion on CatOrDog {
        __typename
      }
    `);
  });

  it('Direct field selection on union', () => {
    expectErrors(`
      fragment directFieldSelectionOnUnion on CatOrDog {
        directField
      }
    `).to.deep.equal([undefinedField('directField', 'CatOrDog', [], [], 3, 9)]);
  });

  it('Defined on implementors queried on union', () => {
    expectErrors(`
      fragment definedOnImplementorsQueriedOnUnion on CatOrDog {
        name
      }
    `).to.deep.equal([
      undefinedField(
        'name',
        'CatOrDog',
        ['Being', 'Pet', 'Canine', 'Dog', 'Cat'],
        [],
        3,
        9,
      ),
    ]);
  });

  it('valid field in inline fragment', () => {
    expectValid(`
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
      expect(undefinedFieldMessage('f', 'T', [], [])).to.equal(
        'Cannot query field "f" on type "T".',
      );
    });

    it('Works with no small numbers of type suggestions', () => {
      expect(undefinedFieldMessage('f', 'T', ['A', 'B'], [])).to.equal(
        'Cannot query field "f" on type "T". Did you mean to use an inline fragment on "A" or "B"?',
      );
    });

    it('Works with no small numbers of field suggestions', () => {
      expect(undefinedFieldMessage('f', 'T', [], ['z', 'y'])).to.equal(
        'Cannot query field "f" on type "T". Did you mean "z" or "y"?',
      );
    });

    it('Only shows one set of suggestions at a time, preferring types', () => {
      expect(undefinedFieldMessage('f', 'T', ['A', 'B'], ['z', 'y'])).to.equal(
        'Cannot query field "f" on type "T". Did you mean to use an inline fragment on "A" or "B"?',
      );
    });

    it('Limits lots of type suggestions', () => {
      expect(
        undefinedFieldMessage('f', 'T', ['A', 'B', 'C', 'D', 'E', 'F'], []),
      ).to.equal(
        'Cannot query field "f" on type "T". Did you mean to use an inline fragment on "A", "B", "C", "D", or "E"?',
      );
    });

    it('Limits lots of field suggestions', () => {
      expect(
        undefinedFieldMessage('f', 'T', [], ['z', 'y', 'x', 'w', 'v', 'u']),
      ).to.equal(
        'Cannot query field "f" on type "T". Did you mean "z", "y", "x", "w", or "v"?',
      );
    });
  });
});
