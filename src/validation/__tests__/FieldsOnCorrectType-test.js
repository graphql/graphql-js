// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import { buildSchema } from '../../utilities/buildASTSchema';

import { validate } from '../validate';
import { FieldsOnCorrectType } from '../rules/FieldsOnCorrectType';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr) {
  return expectValidationErrors(FieldsOnCorrectType, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
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
      {
        message: 'Cannot query field "unknown_pet_field" on type "Pet".',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message: 'Cannot query field "unknown_cat_field" on type "Cat".',
        locations: [{ line: 5, column: 13 }],
      },
    ]);
  });

  it('Field not defined on fragment', () => {
    expectErrors(`
      fragment fieldNotDefined on Dog {
        meowVolume
      }
    `).to.deep.equal([
      {
        message:
          'Cannot query field "meowVolume" on type "Dog". Did you mean "barkVolume"?',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Ignores deeply unknown field', () => {
    expectErrors(`
      fragment deepFieldNotDefined on Dog {
        unknown_field {
          deeper_unknown_field
        }
      }
    `).to.deep.equal([
      {
        message: 'Cannot query field "unknown_field" on type "Dog".',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Sub-field not defined', () => {
    expectErrors(`
      fragment subFieldNotDefined on Human {
        pets {
          unknown_field
        }
      }
    `).to.deep.equal([
      {
        message: 'Cannot query field "unknown_field" on type "Pet".',
        locations: [{ line: 4, column: 11 }],
      },
    ]);
  });

  it('Field not defined on inline fragment', () => {
    expectErrors(`
      fragment fieldNotDefined on Pet {
        ... on Dog {
          meowVolume
        }
      }
    `).to.deep.equal([
      {
        message:
          'Cannot query field "meowVolume" on type "Dog". Did you mean "barkVolume"?',
        locations: [{ line: 4, column: 11 }],
      },
    ]);
  });

  it('Aliased field target not defined', () => {
    expectErrors(`
      fragment aliasedFieldTargetNotDefined on Dog {
        volume : mooVolume
      }
    `).to.deep.equal([
      {
        message:
          'Cannot query field "mooVolume" on type "Dog". Did you mean "barkVolume"?',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Aliased lying field target not defined', () => {
    expectErrors(`
      fragment aliasedLyingFieldTargetNotDefined on Dog {
        barkVolume : kawVolume
      }
    `).to.deep.equal([
      {
        message:
          'Cannot query field "kawVolume" on type "Dog". Did you mean "barkVolume"?',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Not defined on interface', () => {
    expectErrors(`
      fragment notDefinedOnInterface on Pet {
        tailLength
      }
    `).to.deep.equal([
      {
        message: 'Cannot query field "tailLength" on type "Pet".',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Defined on implementors but not on interface', () => {
    expectErrors(`
      fragment definedOnImplementorsButNotInterface on Pet {
        nickname
      }
    `).to.deep.equal([
      {
        message:
          'Cannot query field "nickname" on type "Pet". Did you mean to use an inline fragment on "Dog" or "Cat"?',
        locations: [{ line: 3, column: 9 }],
      },
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
    `).to.deep.equal([
      {
        message: 'Cannot query field "directField" on type "CatOrDog".',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Defined on implementors queried on union', () => {
    expectErrors(`
      fragment definedOnImplementorsQueriedOnUnion on CatOrDog {
        name
      }
    `).to.deep.equal([
      {
        message:
          'Cannot query field "name" on type "CatOrDog". Did you mean to use an inline fragment on "Being", "Pet", "Canine", "Dog", or "Cat"?',
        locations: [{ line: 3, column: 9 }],
      },
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
    function expectErrorMessage(schema, queryStr) {
      const errors = validate(schema, parse(queryStr), [FieldsOnCorrectType]);
      expect(errors.length).to.equal(1);
      return expect(errors[0].message);
    }

    it('Works with no suggestions', () => {
      const schema = buildSchema(`
        type T {
          fieldWithVeryLongNameThatWillNeverBeSuggested: String
        }
        type Query { t: T }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T".',
      );
    });

    it('Works with no small numbers of type suggestions', () => {
      const schema = buildSchema(`
        union T = A | B
        type Query { t: T }

        type A { f: String }
        type B { f: String }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T". Did you mean to use an inline fragment on "A" or "B"?',
      );
    });

    it('Works with no small numbers of field suggestions', () => {
      const schema = buildSchema(`
        type T {
          y: String
          z: String
        }
        type Query { t: T }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T". Did you mean "y" or "z"?',
      );
    });

    it('Only shows one set of suggestions at a time, preferring types', () => {
      const schema = buildSchema(`
        interface T {
          y: String
          z: String
        }
        type Query { t: T }

        type A implements T {
          f: String
          y: String
          z: String
        }
        type B implements T {
          f: String
          y: String
          z: String
        }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T". Did you mean to use an inline fragment on "A" or "B"?',
      );
    });

    it('Limits lots of type suggestions', () => {
      const schema = buildSchema(`
        union T = A | B | C | D | E | F
        type Query { t: T }

        type A { f: String }
        type B { f: String }
        type C { f: String }
        type D { f: String }
        type E { f: String }
        type F { f: String }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T". Did you mean to use an inline fragment on "A", "B", "C", "D", or "E"?',
      );
    });

    it('Limits lots of field suggestions', () => {
      const schema = buildSchema(`
        type T {
          u: String
          v: String
          w: String
          x: String
          y: String
          z: String
        }
        type Query { t: T }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T". Did you mean "u", "v", "w", "x", or "y"?',
      );
    });
  });
});
