import { describe, it } from 'mocha';

import type { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import { UniqueEnumValueNamesRule } from '../rules/UniqueEnumValueNamesRule';

import { expectSDLValidationErrors } from './harness';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return expectSDLValidationErrors(schema, UniqueEnumValueNamesRule, sdlStr);
}

function expectValidSDL(sdlStr: string, schema?: GraphQLSchema) {
  expectSDLErrors(sdlStr, schema).toDeepEqual([]);
}

describe('Validate: Unique enum value names', () => {
  it('no values', () => {
    expectValidSDL(`
      enum SomeEnum
    `);
  });

  it('one value', () => {
    expectValidSDL(`
      enum SomeEnum {
        FOO
      }
    `);
  });

  it('multiple values', () => {
    expectValidSDL(`
      enum SomeEnum {
        FOO
        BAR
      }
    `);
  });

  it('duplicate values inside the same enum definition', () => {
    expectSDLErrors(`
      enum SomeEnum {
        FOO
        BAR
        FOO
      }
    `).toDeepEqual([
      {
        message: 'Enum value "SomeEnum.FOO" can only be defined once.',
        locations: [
          { line: 3, column: 9 },
          { line: 5, column: 9 },
        ],
      },
    ]);
  });

  it('extend enum with new value', () => {
    expectValidSDL(`
      enum SomeEnum {
        FOO
      }
      extend enum SomeEnum {
        BAR
      }
      extend enum SomeEnum {
        BAZ
      }
    `);
  });

  it('extend enum with duplicate value', () => {
    expectSDLErrors(`
      extend enum SomeEnum {
        FOO
      }
      enum SomeEnum {
        FOO
      }
    `).toDeepEqual([
      {
        message: 'Enum value "SomeEnum.FOO" can only be defined once.',
        locations: [
          { line: 3, column: 9 },
          { line: 6, column: 9 },
        ],
      },
    ]);
  });

  it('duplicate value inside extension', () => {
    expectSDLErrors(`
      enum SomeEnum
      extend enum SomeEnum {
        FOO
        BAR
        FOO
      }
    `).toDeepEqual([
      {
        message: 'Enum value "SomeEnum.FOO" can only be defined once.',
        locations: [
          { line: 4, column: 9 },
          { line: 6, column: 9 },
        ],
      },
    ]);
  });

  it('duplicate value inside different extensions', () => {
    expectSDLErrors(`
      enum SomeEnum
      extend enum SomeEnum {
        FOO
      }
      extend enum SomeEnum {
        FOO
      }
    `).toDeepEqual([
      {
        message: 'Enum value "SomeEnum.FOO" can only be defined once.',
        locations: [
          { line: 4, column: 9 },
          { line: 7, column: 9 },
        ],
      },
    ]);
  });

  it('adding new value to the type inside existing schema', () => {
    const schema = buildSchema('enum SomeEnum');
    const sdl = `
      extend enum SomeEnum {
        FOO
      }
    `;

    expectValidSDL(sdl, schema);
  });

  it('adding conflicting value to existing schema twice', () => {
    const schema = buildSchema(`
      enum SomeEnum {
        FOO
      }
    `);
    const sdl = `
      extend enum SomeEnum {
        FOO
      }
      extend enum SomeEnum {
        FOO
      }
    `;

    expectSDLErrors(sdl, schema).toDeepEqual([
      {
        message:
          'Enum value "SomeEnum.FOO" already exists in the schema. It cannot also be defined in this type extension.',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message:
          'Enum value "SomeEnum.FOO" already exists in the schema. It cannot also be defined in this type extension.',
        locations: [{ line: 6, column: 9 }],
      },
    ]);
  });

  it('adding enum values to existing schema twice', () => {
    const schema = buildSchema('enum SomeEnum');
    const sdl = `
      extend enum SomeEnum {
        FOO
      }
      extend enum SomeEnum {
        FOO
      }
    `;

    expectSDLErrors(sdl, schema).toDeepEqual([
      {
        message: 'Enum value "SomeEnum.FOO" can only be defined once.',
        locations: [
          { line: 3, column: 9 },
          { line: 6, column: 9 },
        ],
      },
    ]);
  });
});
