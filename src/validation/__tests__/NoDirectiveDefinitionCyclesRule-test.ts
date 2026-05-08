import { describe, it } from 'node:test';

import { expectJSON } from '../../__testUtils__/expectJSON.ts';

import { parse } from '../../language/parser.ts';

import type { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { NoDirectiveDefinitionCyclesRule } from '../rules/NoDirectiveDefinitionCyclesRule.ts';
import { validateSDL } from '../validate.ts';

function expectErrors(
  sdlStr: string,
  schema?: GraphQLSchema,
  parseOptions?: { experimentalDirectivesOnDirectiveDefinitions?: boolean },
) {
  const doc = parse(sdlStr, parseOptions);
  const errors = validateSDL(doc, schema, [NoDirectiveDefinitionCyclesRule]);
  return expectJSON(errors);
}

function expectValid(
  sdlStr: string,
  schema?: GraphQLSchema,
  parseOptions?: { experimentalDirectivesOnDirectiveDefinitions?: boolean },
) {
  expectErrors(sdlStr, schema, parseOptions).toDeepEqual([]);
}

describe('Validate: No directive definition cycles', () => {
  it('single reference is valid', () => {
    expectValid(`
      directive @a(arg: String @b) on FIELD_DEFINITION
      directive @b on ARGUMENT_DEFINITION
    `);
  });

  it('does not false positive on unknown directive', () => {
    expectValid(`
      directive @a(arg: String @unknown) on FIELD_DEFINITION
    `);
  });

  it('rejects a self-referential directive definition', () => {
    expectErrors(`
      directive @self(arg: String @self) on FIELD_DEFINITION
    `).toDeepEqual([
      {
        message: 'Cannot reference directive "@self" within itself.',
        locations: [{ line: 2, column: 35 }],
      },
    ]);
  });

  it('rejects directives applied to their own definitions', () => {
    expectErrors(
      `
        directive @self @self on DIRECTIVE_DEFINITION
      `,
      undefined,
      {
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    ).toDeepEqual([
      {
        message: 'Cannot reference directive "@self" within itself.',
        locations: [{ line: 2, column: 25 }],
      },
    ]);
  });

  it('rejects directive definitions with circular references', () => {
    expectErrors(`
      directive @a(arg: String @b) on FIELD_DEFINITION
      directive @b(arg: String @a) on FIELD_DEFINITION
    `).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of directive applications: "@b", "@a".',
        locations: [
          { line: 2, column: 32 },
          { line: 3, column: 32 },
        ],
      },
    ]);
  });

  it('rejects directive definitions with overlapping circular references', () => {
    expectErrors(`
      directive @a(arg: String @b) on FIELD_DEFINITION
      directive @b(arg: String @c) on FIELD_DEFINITION
      directive @c(first: String @a, second: String @d) on FIELD_DEFINITION
      directive @d(arg: String @b) on FIELD_DEFINITION
    `).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of directive applications: "@b", "@c", "@a".',
        locations: [
          { line: 2, column: 32 },
          { line: 3, column: 32 },
          { line: 4, column: 34 },
        ],
      },
      {
        message:
          'Cannot reference directive "@b" within itself through a series of directive applications: "@c", "@d", "@b".',
        locations: [
          { line: 3, column: 32 },
          { line: 4, column: 53 },
          { line: 5, column: 32 },
        ],
      },
    ]);
  });

  it('rejects directive definitions with multiple cycles through the same directive', () => {
    expectErrors(`
      directive @a(first: String @b, second: String @c) on FIELD_DEFINITION
      directive @b(arg: String @a) on FIELD_DEFINITION
      directive @c(arg: String @a) on FIELD_DEFINITION
    `).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of directive applications: "@b", "@a".',
        locations: [
          { line: 2, column: 34 },
          { line: 3, column: 32 },
        ],
      },
      {
        message:
          'Cannot reference directive "@a" within itself through a series of directive applications: "@c", "@a".',
        locations: [
          { line: 2, column: 53 },
          { line: 4, column: 32 },
        ],
      },
    ]);
  });

  it('rejects directive definitions that recurse through a directive on a referenced type', () => {
    expectErrors(`
      directive @a(arg: InputObject) on INPUT_OBJECT

      input InputObject @a {
        value: String
      }
    `).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of references: "InputObject", "@a".',
        locations: [
          { line: 2, column: 25 },
          { line: 4, column: 25 },
        ],
      },
    ]);
  });

  it('rejects directive definitions that recurse through a referenced type', () => {
    expectErrors(`
      directive @a(arg: InputObject) on FIELD_DEFINITION

      input InputObject {
        value: String @a
      }
    `).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of references: "InputObject", "@a".',
        locations: [
          { line: 2, column: 25 },
          { line: 5, column: 23 },
        ],
      },
    ]);
  });

  it('does not duplicate cycles through recursive referenced types', () => {
    expectErrors(`
      directive @a(arg: InputObject) on INPUT_FIELD_DEFINITION
      input InputObject {
        self: InputObject @a
      }
    `).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of references: "InputObject", "@a".',
        locations: [
          { line: 2, column: 25 },
          { line: 4, column: 27 },
        ],
      },
    ]);
  });

  it('rejects type extensions that create cycles with existing directives', () => {
    const schema = buildSchema(
      `
        directive @a(arg: InputObject) on INPUT_FIELD_DEFINITION
        input InputObject {
          value: String
        }
      `,
      { noLocation: true },
    );

    expectErrors(
      `
        extend input InputObject {
          recursive: String @a
        }
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of references: "InputObject", "@a".',
        locations: [{ line: 3, column: 29 }],
      },
    ]);
  });

  it('rejects directives on directive definitions when the syntax exists', () => {
    expectErrors(
      `
        directive @a @b on DIRECTIVE_DEFINITION
        directive @b @a on DIRECTIVE_DEFINITION
      `,
      undefined,
      {
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    ).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of directive applications: "@b", "@a".',
        locations: [
          { line: 2, column: 22 },
          { line: 3, column: 22 },
        ],
      },
    ]);
  });

  it('rejects directive extensions with circular references', () => {
    const schema = buildSchema(
      `
        directive @a on DIRECTIVE_DEFINITION
        directive @b on DIRECTIVE_DEFINITION
      `,
      {
        noLocation: true,
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    );

    expectErrors(
      `
        extend directive @a @b
        extend directive @b @a
      `,
      schema,
      {
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    ).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of directive applications: "@b", "@a".',
        locations: [
          { line: 2, column: 29 },
          { line: 3, column: 29 },
        ],
      },
    ]);
  });

  it('rejects directive extensions that close cycles through stored directive definitions', () => {
    const schema = buildSchema(
      `
        directive @a @b on DIRECTIVE_DEFINITION
        directive @b on DIRECTIVE_DEFINITION
      `,
      {
        noLocation: true,
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    );

    expectErrors(
      `
        extend directive @b @a
      `,
      schema,
      {
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    ).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of directive applications: "@b", "@a".',
        locations: [{ line: 2, column: 29 }],
      },
    ]);
  });

  it('rejects directive extensions that close cycles through stored directive extensions', () => {
    const schema = buildSchema(
      `
        directive @a on DIRECTIVE_DEFINITION
        directive @b on DIRECTIVE_DEFINITION
        extend directive @a @b
      `,
      {
        noLocation: true,
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    );

    expectErrors(
      `
        extend directive @b @a
      `,
      schema,
      {
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    ).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of directive applications: "@b", "@a".',
        locations: [{ line: 2, column: 29 }],
      },
    ]);
  });

  it('rejects directive extensions that close cycles through stored type definitions', () => {
    const schema = buildSchema(
      `
        directive @a(arg: InputObject) on INPUT_FIELD_DEFINITION
        input InputObject {
          field: String @b
        }
        directive @b on INPUT_FIELD_DEFINITION
      `,
      { noLocation: true },
    );

    expectErrors(
      `
        extend directive @b @a
      `,
      schema,
      {
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    ).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of references: "InputObject", "@b", "@a".',
        locations: [{ line: 2, column: 29 }],
      },
    ]);
  });

  it('rejects directive extensions that close cycles through stored type extensions', () => {
    const schema = buildSchema(
      `
        directive @a(arg: InputObject) on DIRECTIVE_DEFINITION
        input InputObject {
          value: String
        }
        extend input InputObject @b {
          field: String
        }
        directive @b on INPUT_OBJECT
      `,
      { noLocation: true },
    );

    expectErrors(
      `
        extend directive @b @a
      `,
      schema,
      {
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    ).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of references: "InputObject", "@b", "@a".',
        locations: [{ line: 2, column: 29 }],
      },
    ]);
  });

  it('rejects directive extensions that close cycles through stored input object extension fields', () => {
    const schema = buildSchema(
      `
        directive @a(arg: InputObject) on DIRECTIVE_DEFINITION
        input InputObject {
          value: String
        }
        extend input InputObject {
          field: String @b
        }
        directive @b on INPUT_FIELD_DEFINITION
      `,
      { noLocation: true },
    );

    expectErrors(
      `
        extend directive @b @a
      `,
      schema,
      {
        experimentalDirectivesOnDirectiveDefinitions: true,
      },
    ).toDeepEqual([
      {
        message:
          'Cannot reference directive "@a" within itself through a series of references: "InputObject", "@b", "@a".',
        locations: [{ line: 2, column: 29 }],
      },
    ]);
  });
});
