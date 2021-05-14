import { describe, it } from 'mocha';

import type { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import { KnownDirectivesRule } from '../rules/KnownDirectivesRule';

import { expectValidationErrors, expectSDLValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(KnownDirectivesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).to.deep.equal([]);
}

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return expectSDLValidationErrors(schema, KnownDirectivesRule, sdlStr);
}

function expectValidSDL(sdlStr: string, schema?: GraphQLSchema) {
  expectSDLErrors(sdlStr, schema).to.deep.equal([]);
}

const schemaWithSDLDirectives = buildSchema(`
  directive @onSchema on SCHEMA
  directive @onScalar on SCALAR
  directive @onObject on OBJECT
  directive @onFieldDefinition on FIELD_DEFINITION
  directive @onArgumentDefinition on ARGUMENT_DEFINITION
  directive @onInterface on INTERFACE
  directive @onUnion on UNION
  directive @onEnum on ENUM
  directive @onEnumValue on ENUM_VALUE
  directive @onInputObject on INPUT_OBJECT
  directive @onInputFieldDefinition on INPUT_FIELD_DEFINITION
`);

describe('Validate: Known directives', () => {
  it('with no directives', () => {
    expectValid(`
      query Foo {
        name
        ...Frag
      }

      fragment Frag on Dog {
        name
      }
    `);
  });

  it('with known directives', () => {
    expectValid(`
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

  it('with unknown directive', () => {
    expectErrors(`
      {
        dog @unknown(directive: "value") {
          name
        }
      }
    `).to.deep.equal([
      {
        message: 'Unknown directive "@unknown".',
        locations: [{ line: 3, column: 13 }],
      },
    ]);
  });

  it('with many unknown directives', () => {
    expectErrors(`
      {
        dog @unknown(directive: "value") {
          name
        }
        human @unknown(directive: "value") {
          name
          pets @unknown(directive: "value") {
            name
          }
        }
      }
    `).to.deep.equal([
      {
        message: 'Unknown directive "@unknown".',
        locations: [{ line: 3, column: 13 }],
      },
      {
        message: 'Unknown directive "@unknown".',
        locations: [{ line: 6, column: 15 }],
      },
      {
        message: 'Unknown directive "@unknown".',
        locations: [{ line: 8, column: 16 }],
      },
    ]);
  });

  it('with well placed directives', () => {
    expectValid(`
      query ($var: Boolean) @onQuery {
        name @include(if: $var)
        ...Frag @include(if: true)
        skippedField @skip(if: true)
        ...SkippedFrag @skip(if: true)

        ... @skip(if: true) {
          skippedField
        }
      }

      mutation @onMutation {
        someField
      }

      subscription @onSubscription {
        someField
      }

      fragment Frag on SomeType @onFragmentDefinition {
        someField
      }
    `);
  });

  it('with well placed variable definition directive', () => {
    expectValid(`
      query Foo($var: Boolean @onVariableDefinition) {
        name
      }
    `);
  });

  it('with misplaced directives', () => {
    expectErrors(`
      query Foo($var: Boolean) @include(if: true) {
        name @onQuery @include(if: $var)
        ...Frag @onQuery
      }

      mutation Bar @onQuery {
        someField
      }
    `).to.deep.equal([
      {
        message: 'Directive "@include" may not be used on QUERY.',
        locations: [{ line: 2, column: 32 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on FIELD.',
        locations: [{ line: 3, column: 14 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on FRAGMENT_SPREAD.',
        locations: [{ line: 4, column: 17 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on MUTATION.',
        locations: [{ line: 7, column: 20 }],
      },
    ]);
  });

  it('with misplaced variable definition directive', () => {
    expectErrors(`
      query Foo($var: Boolean @onField) {
        name
      }
    `).to.deep.equal([
      {
        message: 'Directive "@onField" may not be used on VARIABLE_DEFINITION.',
        locations: [{ line: 2, column: 31 }],
      },
    ]);
  });

  describe('within SDL', () => {
    it('with directive defined inside SDL', () => {
      expectValidSDL(`
        type Query {
          foo: String @test
        }

        directive @test on FIELD_DEFINITION
      `);
    });

    it('with standard directive', () => {
      expectValidSDL(`
        type Query {
          foo: String @deprecated
        }
      `);
    });

    it('with overridden standard directive', () => {
      expectValidSDL(`
        schema @deprecated {
          query: Query
        }
        directive @deprecated on SCHEMA
      `);
    });

    it('with directive defined in schema extension', () => {
      const schema = buildSchema(`
        type Query {
          foo: String
        }
      `);
      expectValidSDL(
        `
          directive @test on OBJECT

          extend type Query @test
        `,
        schema,
      );
    });

    it('with directive used in schema extension', () => {
      const schema = buildSchema(`
        directive @test on OBJECT

        type Query {
          foo: String
        }
      `);
      expectValidSDL(
        `
          extend type Query @test
        `,
        schema,
      );
    });

    it('with unknown directive in schema extension', () => {
      const schema = buildSchema(`
        type Query {
          foo: String
        }
      `);
      expectSDLErrors(
        `
          extend type Query @unknown
        `,
        schema,
      ).to.deep.equal([
        {
          message: 'Unknown directive "@unknown".',
          locations: [{ line: 2, column: 29 }],
        },
      ]);
    });

    it('with well placed directives', () => {
      expectValidSDL(
        `
          type MyObj implements MyInterface @onObject {
            myField(myArg: Int @onArgumentDefinition): String @onFieldDefinition
          }

          extend type MyObj @onObject

          scalar MyScalar @onScalar

          extend scalar MyScalar @onScalar

          interface MyInterface @onInterface {
            myField(myArg: Int @onArgumentDefinition): String @onFieldDefinition
          }

          extend interface MyInterface @onInterface

          union MyUnion @onUnion = MyObj | Other

          extend union MyUnion @onUnion

          enum MyEnum @onEnum {
            MY_VALUE @onEnumValue
          }

          extend enum MyEnum @onEnum

          input MyInput @onInputObject {
            myField: Int @onInputFieldDefinition
          }

          extend input MyInput @onInputObject

          schema @onSchema {
            query: MyQuery
          }

          extend schema @onSchema
        `,
        schemaWithSDLDirectives,
      );
    });

    it('with misplaced directives', () => {
      expectSDLErrors(
        `
          type MyObj implements MyInterface @onInterface {
            myField(myArg: Int @onInputFieldDefinition): String @onInputFieldDefinition
          }

          scalar MyScalar @onEnum

          interface MyInterface @onObject {
            myField(myArg: Int @onInputFieldDefinition): String @onInputFieldDefinition
          }

          union MyUnion @onEnumValue = MyObj | Other

          enum MyEnum @onScalar {
            MY_VALUE @onUnion
          }

          input MyInput @onEnum {
            myField: Int @onArgumentDefinition
          }

          schema @onObject {
            query: MyQuery
          }

          extend schema @onObject
        `,
        schemaWithSDLDirectives,
      ).to.deep.equal([
        {
          message: 'Directive "@onInterface" may not be used on OBJECT.',
          locations: [{ line: 2, column: 45 }],
        },
        {
          message:
            'Directive "@onInputFieldDefinition" may not be used on ARGUMENT_DEFINITION.',
          locations: [{ line: 3, column: 32 }],
        },
        {
          message:
            'Directive "@onInputFieldDefinition" may not be used on FIELD_DEFINITION.',
          locations: [{ line: 3, column: 65 }],
        },
        {
          message: 'Directive "@onEnum" may not be used on SCALAR.',
          locations: [{ line: 6, column: 27 }],
        },
        {
          message: 'Directive "@onObject" may not be used on INTERFACE.',
          locations: [{ line: 8, column: 33 }],
        },
        {
          message:
            'Directive "@onInputFieldDefinition" may not be used on ARGUMENT_DEFINITION.',
          locations: [{ line: 9, column: 32 }],
        },
        {
          message:
            'Directive "@onInputFieldDefinition" may not be used on FIELD_DEFINITION.',
          locations: [{ line: 9, column: 65 }],
        },
        {
          message: 'Directive "@onEnumValue" may not be used on UNION.',
          locations: [{ line: 12, column: 25 }],
        },
        {
          message: 'Directive "@onScalar" may not be used on ENUM.',
          locations: [{ line: 14, column: 23 }],
        },
        {
          message: 'Directive "@onUnion" may not be used on ENUM_VALUE.',
          locations: [{ line: 15, column: 22 }],
        },
        {
          message: 'Directive "@onEnum" may not be used on INPUT_OBJECT.',
          locations: [{ line: 18, column: 25 }],
        },
        {
          message:
            'Directive "@onArgumentDefinition" may not be used on INPUT_FIELD_DEFINITION.',
          locations: [{ line: 19, column: 26 }],
        },
        {
          message: 'Directive "@onObject" may not be used on SCHEMA.',
          locations: [{ line: 22, column: 18 }],
        },
        {
          message: 'Directive "@onObject" may not be used on SCHEMA.',
          locations: [{ line: 26, column: 25 }],
        },
      ]);
    });
  });
});
