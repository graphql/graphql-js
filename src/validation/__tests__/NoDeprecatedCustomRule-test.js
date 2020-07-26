import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import { NoDeprecatedCustomRule } from '../rules/custom/NoDeprecatedCustomRule';

import { expectValidationErrorsWithSchema } from './harness';

function buildAssertion(sdlStr: string) {
  const schema = buildSchema(sdlStr);
  return { expectErrors, expectValid };

  function expectErrors(queryStr: string) {
    return expectValidationErrorsWithSchema(
      schema,
      NoDeprecatedCustomRule,
      queryStr,
    );
  }

  function expectValid(queryStr: string) {
    expectErrors(queryStr).to.deep.equal([]);
  }
}

describe('Validate: no deprecated', () => {
  describe('no deprecated fields', () => {
    const { expectValid, expectErrors } = buildAssertion(`
      type Query {
        normalField: String
        deprecatedField: String @deprecated(reason: "Some field reason.")
      }
    `);

    it('ignores fields that are not deprecated', () => {
      expectValid(`
        {
          normalField
        }
      `);
    });

    it('ignores unknown fields', () => {
      expectValid(`
        {
          unknownField
        }

        fragment UnknownFragment on UnknownType {
          unknownField
        }
      `);
    });

    it('reports error when a deprecated field is selected', () => {
      const message =
        'The field Query.deprecatedField is deprecated. Some field reason.';

      expectErrors(`
        {
          deprecatedField
        }

        fragment QueryFragment on Query {
          deprecatedField
        }
      `).to.deep.equal([
        { message, locations: [{ line: 3, column: 11 }] },
        { message, locations: [{ line: 7, column: 11 }] },
      ]);
    });
  });

  describe('no deprecated enum values', () => {
    const { expectValid, expectErrors } = buildAssertion(`
      enum EnumType {
        NORMAL_VALUE
        DEPRECATED_VALUE @deprecated(reason: "Some enum reason.")
      }

      type Query {
        someField(enumArg: EnumType): String
      }
    `);

    it('ignores enum values that are not deprecated', () => {
      expectValid(`
        {
          normalField(enumArg: NORMAL_VALUE)
        }
      `);
    });

    it('ignores unknown enum values', () => {
      expectValid(`
        query (
          $unknownValue: EnumType = UNKNOWN_VALUE
          $unknownType: UnknownType = UNKNOWN_VALUE
        ) {
          someField(enumArg: UNKNOWN_VALUE)
          someField(unknownArg: UNKNOWN_VALUE)
          unknownField(unknownArg: UNKNOWN_VALUE)
        }

        fragment SomeFragment on Query {
          someField(enumArg: UNKNOWN_VALUE)
        }
      `);
    });

    it('reports error when a deprecated enum value is used', () => {
      const message =
        'The enum value "EnumType.DEPRECATED_VALUE" is deprecated. Some enum reason.';

      expectErrors(`
        query (
          $variable: EnumType = DEPRECATED_VALUE
        ) {
          someField(enumArg: DEPRECATED_VALUE)
        }

        fragment QueryFragment on Query {
          someField(enumArg: DEPRECATED_VALUE)
        }
      `).to.deep.equal([
        { message, locations: [{ line: 3, column: 33 }] },
        { message, locations: [{ line: 5, column: 30 }] },
        { message, locations: [{ line: 9, column: 30 }] },
      ]);
    });
  });
});
