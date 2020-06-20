// @flow strict

import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import { NoDeprecatedCustomRule } from '../rules/custom/NoDeprecatedCustomRule';

import { expectValidationErrorsWithSchema } from './harness';

function expectErrors(queryStr) {
  return expectValidationErrorsWithSchema(
    schema,
    NoDeprecatedCustomRule,
    queryStr,
  );
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

const schema = buildSchema(`
  enum EnumType {
    NORMAL_VALUE
    DEPRECATED_VALUE @deprecated(reason: "Some enum reason.")
    DEPRECATED_VALUE_WITH_NO_REASON @deprecated
  }

  type Query {
    normalField(enumArg: [EnumType]): String
    deprecatedField: String @deprecated(reason: "Some field reason.")
    deprecatedFieldWithNoReason: String @deprecated
  }
`);

describe('Validate: no deprecated', () => {
  it('ignores fields and enum values that are not deprecated', () => {
    expectValid(`
      {
        normalField(enumArg: [NORMAL_VALUE])
      }
    `);
  });

  it('ignores unknown fields and enum values', () => {
    expectValid(`
      fragment UnknownFragment on UnknownType {
        unknownField(unknownArg: UNKNOWN_VALUE)
      }

      fragment QueryFragment on Query {
        unknownField(unknownArg: UNKNOWN_VALUE)
        normalField(enumArg: UNKNOWN_VALUE)
      }
    `);
  });

  it('reports error when a deprecated field is selected', () => {
    expectErrors(`
      {
        normalField
        deprecatedField
        deprecatedFieldWithNoReason
      }
    `).to.deep.equal([
      {
        message:
          'The field Query.deprecatedField is deprecated. Some field reason.',
        locations: [{ line: 4, column: 9 }],
      },
      {
        message:
          'The field Query.deprecatedFieldWithNoReason is deprecated. No longer supported',
        locations: [{ line: 5, column: 9 }],
      },
    ]);
  });

  it('reports error when a deprecated enum value is used', () => {
    expectErrors(`
      {
        normalField(enumArg: [NORMAL_VALUE, DEPRECATED_VALUE])
        normalField(enumArg: [DEPRECATED_VALUE_WITH_NO_REASON])
      }
    `).to.deep.equal([
      {
        message:
          'The enum value "EnumType.DEPRECATED_VALUE" is deprecated. Some enum reason.',
        locations: [{ line: 3, column: 45 }],
      },
      {
        message:
          'The enum value "EnumType.DEPRECATED_VALUE_WITH_NO_REASON" is deprecated. No longer supported',
        locations: [{ line: 4, column: 31 }],
      },
    ]);
  });

  it('reports error when a deprecated field is selected or an enum value is used inside a fragment', () => {
    expectErrors(`
      fragment QueryFragment on Query {
        deprecatedField
        normalField(enumArg: [NORMAL_VALUE, DEPRECATED_VALUE])
      }
    `).to.deep.equal([
      {
        message:
          'The field Query.deprecatedField is deprecated. Some field reason.',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message:
          'The enum value "EnumType.DEPRECATED_VALUE" is deprecated. Some enum reason.',
        locations: [{ line: 4, column: 45 }],
      },
    ]);
  });
});
