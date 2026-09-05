import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import { GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { NoReservedTypeSystemNamesTypeSystemValidation } from '../NoReservedTypeSystemNamesRule.ts';

function expectSDLErrors(sdlStr: string) {
  const doc = parse(sdlStr, { noLocation: true });
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [NoReservedTypeSystemNamesTypeSystemValidation],
  });
  return expectJSON(errors);
}

function expectSDLErrorsWithLocations(sdlStr: string) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [NoReservedTypeSystemNamesTypeSystemValidation],
  });
  return expectJSON(errors);
}

describe('Validate: NoReservedTypeSystemNamesRule', () => {
  it('rejects reserved SDL type system names', () => {
    expectSDLErrors(`
      directive @tag on SCALAR

      scalar __Scalar
      extend scalar __Scalar @tag

      type __Object {
        __field(__arg: String): String
      }
      extend type __Object {
        __field2: String
      }

      interface __Interface {
        __field: String
      }
      extend interface __Interface {
        __field2: String
      }

      union __Union = __Object
      extend union __Union = __Object

      enum __Enum {
        __VALUE
      }
      extend enum __Enum {
        __VALUE2
      }

      input __Input {
        __inputField: String
      }
      extend input __Input {
        __inputField2: String
      }

      directive @__directive(__arg: String) on FIELD_DEFINITION
    `).toDeepEqual([
      reserved('__Scalar'),
      reserved('__Scalar'),
      reserved('__Object'),
      reserved('__field'),
      reserved('__arg'),
      reserved('__Object'),
      reserved('__field2'),
      reserved('__Interface'),
      reserved('__field'),
      reserved('__Interface'),
      reserved('__field2'),
      reserved('__Union'),
      reserved('__Union'),
      reserved('__Enum'),
      reserved('__VALUE'),
      reserved('__Enum'),
      reserved('__VALUE2'),
      reserved('__Input'),
      reserved('__inputField'),
      reserved('__Input'),
      reserved('__inputField2'),
      reserved('__directive'),
      reserved('__arg'),
    ]);
  });

  it('accepts non-reserved SDL type system names', () => {
    expectSDLErrors(`
      type Query {
        field(arg: String): String
      }
    `).toDeepEqual([]);
  });

  it('checks directive-only extensions without child definitions', () => {
    expectSDLErrors(`
      directive @tag on OBJECT | INTERFACE | ENUM

      extend type __Object @tag
      extend interface __Interface @tag
      extend enum __Enum @tag
    `).toDeepEqual([
      reserved('__Object'),
      reserved('__Interface'),
      reserved('__Enum'),
    ]);
  });

  it('reports reserved SDL type system names on the name node', () => {
    expectSDLErrorsWithLocations(`
      type __Object {
        __field(__arg: String): String
      }
    `).toDeepEqual([
      {
        message:
          'Name "__Object" must not begin with "__", which is reserved by GraphQL introspection.',
        locations: [{ line: 2, column: 12 }],
      },
      {
        message:
          'Name "__field" must not begin with "__", which is reserved by GraphQL introspection.',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message:
          'Name "__arg" must not begin with "__", which is reserved by GraphQL introspection.',
        locations: [{ line: 3, column: 17 }],
      },
    ]);
  });

  it('rejects reserved schema type system names', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: '__Query',
        fields: {
          __field: {
            type: GraphQLString,
            args: { __arg: { type: GraphQLString } },
          },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [NoReservedTypeSystemNamesTypeSystemValidation],
      }),
    ).toDeepEqual([
      reserved('__Query'),
      reserved('__field'),
      reserved('__arg'),
    ]);
  });
});

function reserved(name: string): { message: string } {
  return {
    message: `Name "${name}" must not begin with "__", which is reserved by GraphQL introspection.`,
  };
}
