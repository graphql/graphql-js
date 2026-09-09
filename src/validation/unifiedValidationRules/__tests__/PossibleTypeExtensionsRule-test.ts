import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { validateWithRules } from '../../index.ts';

import { PossibleTypeExtensionsTypeSystemValidation } from '../PossibleTypeExtensionsRule.ts';

import { expectSDLRuleErrors } from './harness.ts';

describe('Validate: PossibleTypeExtensionsRule', () => {
  it('validates SDL type extensions', () => {
    expectSDLRuleErrors(
      PossibleTypeExtensionsTypeSystemValidation,
      `
        extend type Missing { field: String }
        type Query { field: String }
      `,
    ).toDeepEqual([
      { message: 'Cannot extend type "Missing" because it is not defined.' },
    ]);
  });

  it('rejects extensions whose kind does not match the SDL definition', () => {
    expectSDLRuleErrors(
      PossibleTypeExtensionsTypeSystemValidation,
      `
        scalar Scalar

        type Object {
          field: String
        }

        interface Interface {
          field: String
        }

        union Union = Object

        enum Enum {
          VALUE
        }

        input Input {
          field: String
        }

        extend type Scalar {
          field: String
        }

        extend scalar Object @specifiedBy(url: "https://example.com")

        extend interface Object {
          other: String
        }

        extend union Object = Object

        extend enum Object {
          OTHER
        }

        extend input Object {
          other: String
        }
      `,
    ).toDeepEqual([
      { message: 'Cannot extend non-object type "Scalar".' },
      { message: 'Cannot extend non-scalar type "Object".' },
      { message: 'Cannot extend non-interface type "Object".' },
      { message: 'Cannot extend non-union type "Object".' },
      { message: 'Cannot extend non-enum type "Object".' },
      { message: 'Cannot extend non-input object type "Object".' },
    ]);
  });

  it('accepts extensions whose kind matches SDL definitions', () => {
    expectSDLRuleErrors(
      PossibleTypeExtensionsTypeSystemValidation,
      `
        scalar Scalar

        type Object {
          field: String
        }

        interface Interface {
          field: String
        }

        union Union = Object

        enum Enum {
          VALUE
        }

        input Input {
          field: String
        }

        extend scalar Scalar @specifiedBy(url: "https://example.com")

        extend type Object {
          other: String
        }

        extend interface Interface {
          other: String
        }

        extend union Union = Object

        extend enum Enum {
          OTHER
        }

        extend input Input {
          other: String
        }
      `,
    ).toDeepEqual([]);
  });

  it('accepts extensions whose kind matches existing schema types', () => {
    const schema = buildSchema(`
      scalar ExistingScalar

      type ExistingObject {
        field: String
      }

      interface ExistingInterface {
        field: String
      }

      union ExistingUnion = ExistingObject

      enum ExistingEnum {
        VALUE
      }

      input ExistingInput {
        field: String
      }

      type Query {
        object: ExistingObject
      }
    `);

    expectSDLRuleErrors(
      PossibleTypeExtensionsTypeSystemValidation,
      `
        extend scalar ExistingScalar @specifiedBy(url: "https://example.com")

        extend type ExistingObject {
          other: String
        }

        extend interface ExistingInterface {
          other: String
        }

        extend union ExistingUnion = ExistingObject

        extend enum ExistingEnum {
          OTHER
        }

        extend input ExistingInput {
          other: String
        }
      `,
      schema,
    ).toDeepEqual([]);
  });

  it('rejects extensions whose kind does not match existing schema types', () => {
    const schema = buildSchema(`
      scalar ExistingScalar

      type Query {
        field: String
      }
    `);

    expectSDLRuleErrors(
      PossibleTypeExtensionsTypeSystemValidation,
      `
        extend type Absent {
          field: String
        }

        extend type ExistingScalar {
          field: String
        }
      `,
      schema,
    ).toDeepEqual([
      { message: 'Cannot extend type "Absent" because it is not defined.' },
      { message: 'Cannot extend non-object type "ExistingScalar".' },
    ]);
  });

  it('can hide type extension suggestions', () => {
    const schema = buildSchema(`
      type ExistingType {
        field: String
      }

      type Query {
        field: ExistingType
      }
    `);

    expectJSON(
      validateWithRules({
        documentAST: parse('extend type ExistingTyp { other: String }', {
          noLocation: true,
        }),
        typeSystemRules: [PossibleTypeExtensionsTypeSystemValidation],
        schema,
        hideSuggestions: true,
      }),
    ).toDeepEqual([
      {
        message: 'Cannot extend type "ExistingTyp" because it is not defined.',
      },
    ]);
  });
});
