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
    expectErrors(queryStr).toDeepEqual([]);
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
          deprecatedField
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
      `).toDeepEqual([
        { message, locations: [{ line: 3, column: 11 }] },
        { message, locations: [{ line: 7, column: 11 }] },
      ]);
    });
  });

  describe('no deprecated arguments on fields', () => {
    const { expectValid, expectErrors } = buildAssertion(`
      type Query {
        someField(
          normalArg: String,
          deprecatedArg: String @deprecated(reason: "Some arg reason."),
        ): String
      }
    `);

    it('ignores arguments that are not deprecated', () => {
      expectValid(`
        {
          normalField(normalArg: "")
        }
      `);
    });

    it('ignores unknown arguments', () => {
      expectValid(`
        {
          someField(unknownArg: "")
          unknownField(deprecatedArg: "")
        }
      `);
    });

    it('reports error when a deprecated argument is used', () => {
      expectErrors(`
        {
          someField(deprecatedArg: "")
        }
      `).toDeepEqual([
        {
          message:
            'Field "Query.someField" argument "deprecatedArg" is deprecated. Some arg reason.',
          locations: [{ line: 3, column: 21 }],
        },
      ]);
    });
  });

  describe('no deprecated arguments on directives', () => {
    const { expectValid, expectErrors } = buildAssertion(`
      type Query {
        someField: String
      }

      directive @someDirective(
        normalArg: String,
        deprecatedArg: String @deprecated(reason: "Some arg reason."),
      ) on FIELD
    `);

    it('ignores arguments that are not deprecated', () => {
      expectValid(`
        {
          someField @someDirective(normalArg: "")
        }
      `);
    });

    it('ignores unknown arguments', () => {
      expectValid(`
        {
          someField @someDirective(unknownArg: "")
          someField @unknownDirective(deprecatedArg: "")
        }
      `);
    });

    it('reports error when a deprecated argument is used', () => {
      expectErrors(`
        {
          someField @someDirective(deprecatedArg: "")
        }
      `).toDeepEqual([
        {
          message:
            'Directive "@someDirective" argument "deprecatedArg" is deprecated. Some arg reason.',
          locations: [{ line: 3, column: 36 }],
        },
      ]);
    });
  });

  describe('no deprecated input fields', () => {
    const { expectValid, expectErrors } = buildAssertion(`
      input InputType {
        normalField: String
        deprecatedField: String @deprecated(reason: "Some input field reason.")
      }

      type Query {
        someField(someArg: InputType): String
      }

      directive @someDirective(someArg: InputType) on FIELD
    `);

    it('ignores input fields that are not deprecated', () => {
      expectValid(`
        {
          someField(
            someArg: { normalField: "" }
          ) @someDirective(someArg: { normalField: "" })
        }
      `);
    });

    it('ignores unknown input fields', () => {
      expectValid(`
        {
          someField(
            someArg: { unknownField: "" }
          )

          someField(
            unknownArg: { unknownField: "" }
          )

          unknownField(
            unknownArg: { unknownField: "" }
          )
        }
      `);
    });

    it('reports error when a deprecated input field is used', () => {
      const message =
        'The input field InputType.deprecatedField is deprecated. Some input field reason.';

      expectErrors(`
        {
          someField(
            someArg: { deprecatedField: "" }
          ) @someDirective(someArg: { deprecatedField: "" })
        }
      `).toDeepEqual([
        { message, locations: [{ line: 4, column: 24 }] },
        { message, locations: [{ line: 5, column: 39 }] },
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
      `).toDeepEqual([
        { message, locations: [{ line: 3, column: 33 }] },
        { message, locations: [{ line: 5, column: 30 }] },
      ]);
    });
  });
});
