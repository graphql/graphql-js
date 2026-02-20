import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { NoDeprecatedCustomRule } from '../rules/custom/NoDeprecatedCustomRule.js';

import { expectValidationErrorsWithSchema } from './harness.js';

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
            'The argument "Query.someField(deprecatedArg:)" is deprecated. Some arg reason.',
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
            'The argument "@someDirective(deprecatedArg:)" is deprecated. Some arg reason.',
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

  describe('no deprecated types', () => {
    const { expectValid, expectErrors } = buildAssertion(`
      type Query {
        animals: [Animal]
      }

      interface Animal {
        name: String
      }

      type Dog implements Animal {
        name: String
      }

      type Dragon implements Animal @deprecated(reason: "No longer known to exist.") {
        name: String
      }
    `);

    it('ignores non-deprecated types in inline fragments', () => {
      expectValid(`
        {
          animals {
            ... on Dog {
              name
            }
          }
        }
      `);
    });

    it('reports error when a deprecated type is used in inline fragment', () => {
      expectErrors(`
        {
          animals {
            ... on Dragon {
              name
            }
          }
        }
      `).toDeepEqual([
        {
          message: 'The type "Dragon" is deprecated. No longer known to exist.',
          locations: [{ line: 4, column: 20 }],
        },
      ]);
    });

    it('reports error when inline fragment without type condition is in deprecated type context', () => {
      expectErrors(`
        {
          animals {
            ... on Dragon {
              ... {
                name
              }
            }
          }
        }
      `).toDeepEqual([
        {
          message: 'The type "Dragon" is deprecated. No longer known to exist.',
          locations: [{ line: 4, column: 20 }],
        },
        {
          message: 'The type "Dragon" is deprecated. No longer known to exist.',
          locations: [{ line: 5, column: 15 }],
        },
      ]);
    });

    it('reports error when a deprecated type is used in fragment definition', () => {
      expectErrors(`
        {
          animals {
            ...DragonFragment
          }
        }

        fragment DragonFragment on Dragon {
          name
        }
      `).toDeepEqual([
        {
          message: 'The type "Dragon" is deprecated. No longer known to exist.',
          locations: [{ line: 8, column: 36 }],
        },
      ]);
    });
  });
});
