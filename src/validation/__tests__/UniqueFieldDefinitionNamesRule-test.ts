import { describe, it } from 'mocha';

import type { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import { UniqueFieldDefinitionNamesRule } from '../rules/UniqueFieldDefinitionNamesRule';

import { expectSDLValidationErrors } from './harness';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return expectSDLValidationErrors(
    schema,
    UniqueFieldDefinitionNamesRule,
    sdlStr,
  );
}

function expectValidSDL(sdlStr: string, schema?: GraphQLSchema) {
  expectSDLErrors(sdlStr, schema).toDeepEqual([]);
}

describe('Validate: Unique field definition names', () => {
  it('no fields', () => {
    expectValidSDL(`
      type SomeObject
      interface SomeInterface
      input SomeInputObject
    `);
  });

  it('one field', () => {
    expectValidSDL(`
      type SomeObject {
        foo: String
      }

      interface SomeInterface {
        foo: String
      }

      input SomeInputObject {
        foo: String
      }
    `);
  });

  it('multiple fields', () => {
    expectValidSDL(`
      type SomeObject {
        foo: String
        bar: String
      }

      interface SomeInterface {
        foo: String
        bar: String
      }

      input SomeInputObject {
        foo: String
        bar: String
      }
    `);
  });

  it('duplicate fields inside the same type definition', () => {
    expectSDLErrors(`
      type SomeObject {
        foo: String
        bar: String
        foo: String
      }

      interface SomeInterface {
        foo: String
        bar: String
        foo: String
      }

      input SomeInputObject {
        foo: String
        bar: String
        foo: String
      }
    `).toDeepEqual([
      {
        message: 'Field "SomeObject.foo" can only be defined once.',
        locations: [
          { line: 3, column: 9 },
          { line: 5, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInterface.foo" can only be defined once.',
        locations: [
          { line: 9, column: 9 },
          { line: 11, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInputObject.foo" can only be defined once.',
        locations: [
          { line: 15, column: 9 },
          { line: 17, column: 9 },
        ],
      },
    ]);
  });

  it('extend type with new field', () => {
    expectValidSDL(`
      type SomeObject {
        foo: String
      }
      extend type SomeObject {
        bar: String
      }
      extend type SomeObject {
        baz: String
      }

      interface SomeInterface {
        foo: String
      }
      extend interface SomeInterface {
        bar: String
      }
      extend interface SomeInterface {
        baz: String
      }

      input SomeInputObject {
        foo: String
      }
      extend input SomeInputObject {
        bar: String
      }
      extend input SomeInputObject {
        baz: String
      }
    `);
  });

  it('extend type with duplicate field', () => {
    expectSDLErrors(`
      extend type SomeObject {
        foo: String
      }
      type SomeObject {
        foo: String
      }

      extend interface SomeInterface {
        foo: String
      }
      interface SomeInterface {
        foo: String
      }

      extend input SomeInputObject {
        foo: String
      }
      input SomeInputObject {
        foo: String
      }
    `).toDeepEqual([
      {
        message: 'Field "SomeObject.foo" can only be defined once.',
        locations: [
          { line: 3, column: 9 },
          { line: 6, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInterface.foo" can only be defined once.',
        locations: [
          { line: 10, column: 9 },
          { line: 13, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInputObject.foo" can only be defined once.',
        locations: [
          { line: 17, column: 9 },
          { line: 20, column: 9 },
        ],
      },
    ]);
  });

  it('duplicate field inside extension', () => {
    expectSDLErrors(`
      type SomeObject
      extend type SomeObject {
        foo: String
        bar: String
        foo: String
      }

      interface SomeInterface
      extend interface SomeInterface {
        foo: String
        bar: String
        foo: String
      }

      input SomeInputObject
      extend input SomeInputObject {
        foo: String
        bar: String
        foo: String
      }
    `).toDeepEqual([
      {
        message: 'Field "SomeObject.foo" can only be defined once.',
        locations: [
          { line: 4, column: 9 },
          { line: 6, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInterface.foo" can only be defined once.',
        locations: [
          { line: 11, column: 9 },
          { line: 13, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInputObject.foo" can only be defined once.',
        locations: [
          { line: 18, column: 9 },
          { line: 20, column: 9 },
        ],
      },
    ]);
  });

  it('duplicate field inside different extensions', () => {
    expectSDLErrors(`
      type SomeObject
      extend type SomeObject {
        foo: String
      }
      extend type SomeObject {
        foo: String
      }

      interface SomeInterface
      extend interface SomeInterface {
        foo: String
      }
      extend interface SomeInterface {
        foo: String
      }

      input SomeInputObject
      extend input SomeInputObject {
        foo: String
      }
      extend input SomeInputObject {
        foo: String
      }
    `).toDeepEqual([
      {
        message: 'Field "SomeObject.foo" can only be defined once.',
        locations: [
          { line: 4, column: 9 },
          { line: 7, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInterface.foo" can only be defined once.',
        locations: [
          { line: 12, column: 9 },
          { line: 15, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInputObject.foo" can only be defined once.',
        locations: [
          { line: 20, column: 9 },
          { line: 23, column: 9 },
        ],
      },
    ]);
  });

  it('adding new field to the type inside existing schema', () => {
    const schema = buildSchema(`
      type SomeObject
      interface SomeInterface
      input SomeInputObject
    `);
    const sdl = `
      extend type SomeObject {
        foo: String
      }

      extend interface SomeInterface {
        foo: String
      }

      extend input SomeInputObject {
        foo: String
      }
    `;

    expectValidSDL(sdl, schema);
  });

  it('adding conflicting fields to existing schema twice', () => {
    const schema = buildSchema(`
      type SomeObject {
        foo: String
      }

      interface SomeInterface {
        foo: String
      }

      input SomeInputObject {
        foo: String
      }
    `);
    const sdl = `
      extend type SomeObject {
        foo: String
      }
      extend interface SomeInterface {
        foo: String
      }
      extend input SomeInputObject {
        foo: String
      }

      extend type SomeObject {
        foo: String
      }
      extend interface SomeInterface {
        foo: String
      }
      extend input SomeInputObject {
        foo: String
      }
    `;

    expectSDLErrors(sdl, schema).toDeepEqual([
      {
        message:
          'Field "SomeObject.foo" already exists in the schema. It cannot also be defined in this type extension.',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message:
          'Field "SomeInterface.foo" already exists in the schema. It cannot also be defined in this type extension.',
        locations: [{ line: 6, column: 9 }],
      },
      {
        message:
          'Field "SomeInputObject.foo" already exists in the schema. It cannot also be defined in this type extension.',
        locations: [{ line: 9, column: 9 }],
      },
      {
        message:
          'Field "SomeObject.foo" already exists in the schema. It cannot also be defined in this type extension.',
        locations: [{ line: 13, column: 9 }],
      },
      {
        message:
          'Field "SomeInterface.foo" already exists in the schema. It cannot also be defined in this type extension.',
        locations: [{ line: 16, column: 9 }],
      },
      {
        message:
          'Field "SomeInputObject.foo" already exists in the schema. It cannot also be defined in this type extension.',
        locations: [{ line: 19, column: 9 }],
      },
    ]);
  });

  it('adding fields to existing schema twice', () => {
    const schema = buildSchema(`
      type SomeObject
      interface SomeInterface
      input SomeInputObject
    `);
    const sdl = `
      extend type SomeObject {
        foo: String
      }
      extend type SomeObject {
        foo: String
      }

      extend interface SomeInterface {
        foo: String
      }
      extend interface SomeInterface {
        foo: String
      }

      extend input SomeInputObject {
        foo: String
      }
      extend input SomeInputObject {
        foo: String
      }
    `;

    expectSDLErrors(sdl, schema).toDeepEqual([
      {
        message: 'Field "SomeObject.foo" can only be defined once.',
        locations: [
          { line: 3, column: 9 },
          { line: 6, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInterface.foo" can only be defined once.',
        locations: [
          { line: 10, column: 9 },
          { line: 13, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInputObject.foo" can only be defined once.',
        locations: [
          { line: 17, column: 9 },
          { line: 20, column: 9 },
        ],
      },
    ]);
  });
});
