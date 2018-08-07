/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { buildSchema } from '../../utilities';
import {
  expectPassesRule,
  expectFailsRule,
  expectSDLErrorsFromRule,
} from './harness';

import {
  KnownDirectives,
  unknownDirectiveMessage,
  misplacedDirectiveMessage,
} from '../rules/KnownDirectives';

const expectSDLErrors = expectSDLErrorsFromRule.bind(
  undefined,
  KnownDirectives,
);

function unknownDirective(directiveName, line, column) {
  return {
    message: unknownDirectiveMessage(directiveName),
    locations: [{ line, column }],
  };
}

function misplacedDirective(directiveName, placement, line, column) {
  return {
    message: misplacedDirectiveMessage(directiveName, placement),
    locations: [{ line, column }],
  };
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
    expectPassesRule(
      KnownDirectives,
      `
      query Foo {
        name
        ...Frag
      }

      fragment Frag on Dog {
        name
      }
    `,
    );
  });

  it('with known directives', () => {
    expectPassesRule(
      KnownDirectives,
      `
      {
        dog @include(if: true) {
          name
        }
        human @skip(if: false) {
          name
        }
      }
    `,
    );
  });

  it('with unknown directive', () => {
    expectFailsRule(
      KnownDirectives,
      `
      {
        dog @unknown(directive: "value") {
          name
        }
      }
    `,
      [unknownDirective('unknown', 3, 13)],
    );
  });

  it('with many unknown directives', () => {
    expectFailsRule(
      KnownDirectives,
      `
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
    `,
      [
        unknownDirective('unknown', 3, 13),
        unknownDirective('unknown', 6, 15),
        unknownDirective('unknown', 8, 16),
      ],
    );
  });

  it('with well placed directives', () => {
    expectPassesRule(
      KnownDirectives,
      `
      query Foo($var: Boolean @onVariableDefinition) @onQuery {
        name @include(if: $var)
        ...Frag @include(if: true)
        skippedField @skip(if: true)
        ...SkippedFrag @skip(if: true)
      }

      mutation Bar @onMutation {
        someField
      }
    `,
    );
  });

  it('with misplaced directives', () => {
    expectFailsRule(
      KnownDirectives,
      `
      query Foo($var: Boolean @onField) @include(if: true) {
        name @onQuery @include(if: $var)
        ...Frag @onQuery
      }

      mutation Bar @onQuery {
        someField
      }
    `,
      [
        misplacedDirective('onField', 'VARIABLE_DEFINITION', 2, 31),
        misplacedDirective('include', 'QUERY', 2, 41),
        misplacedDirective('onQuery', 'FIELD', 3, 14),
        misplacedDirective('onQuery', 'FRAGMENT_SPREAD', 4, 17),
        misplacedDirective('onQuery', 'MUTATION', 7, 20),
      ],
    );
  });

  describe('within SDL', () => {
    it('with directive defined inside SDL', () => {
      expectSDLErrors(`
        type Query {
          foo: String @test
        }

        directive @test on FIELD_DEFINITION
      `).to.deep.equal([]);
    });

    it('with standard directive', () => {
      expectSDLErrors(`
        type Query {
          foo: String @deprecated
        }
      `).to.deep.equal([]);
    });

    it('with overrided standard directive', () => {
      expectSDLErrors(`
        schema @deprecated {
          query: Query
        }
        directive @deprecated on SCHEMA
      `).to.deep.equal([]);
    });

    it('with directive defined in schema extension', () => {
      const schema = buildSchema(`
        type Query {
          foo: String
        }
      `);
      expectSDLErrors(
        `
          directive @test on OBJECT

          extend type Query  @test
        `,
        schema,
      ).to.deep.equal([]);
    });

    it('with directive used in schema extension', () => {
      const schema = buildSchema(`
        directive @test on OBJECT

        type Query {
          foo: String
        }
      `);
      expectSDLErrors(
        `
          extend type Query @test
        `,
        schema,
      ).to.deep.equal([]);
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
      ).to.deep.equal([unknownDirective('unknown', 2, 29)]);
    });

    it('with well placed directives', () => {
      expectSDLErrors(
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
      ).to.deep.equal([]);
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
        misplacedDirective('onInterface', 'OBJECT', 2, 45),
        misplacedDirective(
          'onInputFieldDefinition',
          'ARGUMENT_DEFINITION',
          3,
          32,
        ),
        misplacedDirective('onInputFieldDefinition', 'FIELD_DEFINITION', 3, 65),
        misplacedDirective('onEnum', 'SCALAR', 6, 27),
        misplacedDirective('onObject', 'INTERFACE', 8, 33),
        misplacedDirective(
          'onInputFieldDefinition',
          'ARGUMENT_DEFINITION',
          9,
          32,
        ),
        misplacedDirective('onInputFieldDefinition', 'FIELD_DEFINITION', 9, 65),
        misplacedDirective('onEnumValue', 'UNION', 12, 25),
        misplacedDirective('onScalar', 'ENUM', 14, 23),
        misplacedDirective('onUnion', 'ENUM_VALUE', 15, 22),
        misplacedDirective('onEnum', 'INPUT_OBJECT', 18, 25),
        misplacedDirective(
          'onArgumentDefinition',
          'INPUT_FIELD_DEFINITION',
          19,
          26,
        ),
        misplacedDirective('onObject', 'SCHEMA', 22, 18),
        misplacedDirective('onObject', 'SCHEMA', 26, 25),
      ]);
    });
  });
});
