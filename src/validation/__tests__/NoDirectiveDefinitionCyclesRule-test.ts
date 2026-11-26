import { describe, it } from 'node:test';

import { expectJSON } from '../../__testUtils__/expectJSON.ts';

import type {
  DirectiveExtensionNode,
  EnumTypeDefinitionNode,
} from '../../language/ast.ts';
import { DirectiveLocation } from '../../language/directiveLocation.ts';
import { parse } from '../../language/parser.ts';

import {
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../../type/definition.ts';
import { GraphQLDirective } from '../../type/directives.ts';
import { GraphQLString } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { NoDirectiveDefinitionCyclesRule } from '../rules/NoDirectiveDefinitionCyclesRule.ts';
import { validateSDL } from '../validate.ts';

function expectErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateSDL(doc, schema, [NoDirectiveDefinitionCyclesRule]);
  return expectJSON(errors);
}

function expectValid(sdlStr: string, schema?: GraphQLSchema) {
  expectErrors(sdlStr, schema).toDeepEqual([]);
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
        message:
          'Directive "@self" forms a reference cycle through: "@self(arg:)", directive application "@self".',
        locations: [
          { line: 2, column: 23 },
          { line: 2, column: 35 },
        ],
      },
    ]);
  });

  it('rejects directives applied to their own definitions', () => {
    expectErrors(`
      directive @self @self on DIRECTIVE_DEFINITION
    `).toDeepEqual([
      {
        message:
          'Directive "@self" forms a reference cycle through: directive application "@self".',
        locations: [{ line: 2, column: 23 }],
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
          'Directive "@a" forms a reference cycle through: "@a(arg:)", directive application "@b", "@b(arg:)", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
          { line: 2, column: 32 },
          { line: 3, column: 20 },
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
          'Directive "@a" forms a reference cycle through: "@a(arg:)", directive application "@b", "@b(arg:)", directive application "@c", "@c(first:)", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
          { line: 2, column: 32 },
          { line: 3, column: 20 },
          { line: 3, column: 32 },
          { line: 4, column: 20 },
          { line: 4, column: 34 },
        ],
      },
      {
        message:
          'Directive "@b" forms a reference cycle through: "@b(arg:)", directive application "@c", "@c(second:)", directive application "@d", "@d(arg:)", directive application "@b".',
        locations: [
          { line: 3, column: 20 },
          { line: 3, column: 32 },
          { line: 4, column: 38 },
          { line: 4, column: 53 },
          { line: 5, column: 20 },
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
          'Directive "@a" forms a reference cycle through: "@a(first:)", directive application "@b", "@b(arg:)", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
          { line: 2, column: 34 },
          { line: 3, column: 20 },
          { line: 3, column: 32 },
        ],
      },
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(second:)", directive application "@c", "@c(arg:)", directive application "@a".',
        locations: [
          { line: 2, column: 38 },
          { line: 2, column: 53 },
          { line: 4, column: 20 },
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
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
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
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", "InputObject.value", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
          { line: 2, column: 25 },
          { line: 5, column: 9 },
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
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", "InputObject.self", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
          { line: 2, column: 25 },
          { line: 4, column: 9 },
          { line: 4, column: 27 },
        ],
      },
    ]);
  });

  it('allows recursive input objects without directive cycles', () => {
    expectValid(`
      directive @a(arg: InputObject) on FIELD_DEFINITION

      input InputObject {
        self: InputObject
      }
    `);
  });

  it('rejects directive definitions that recurse through a referenced enum', () => {
    expectErrors(`
      directive @a(arg: Enum) on ENUM

      enum Enum @a {
        VALUE
      }
    `).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "Enum", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
          { line: 2, column: 25 },
          { line: 4, column: 17 },
        ],
      },
    ]);
  });

  it('rejects directive definitions that recurse through a referenced enum value', () => {
    expectErrors(`
      directive @a(arg: Enum) on ENUM_VALUE

      enum Enum {
        VALUE @a
      }
    `).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "Enum", "Enum.VALUE", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
          { line: 2, column: 25 },
          { line: 5, column: 9 },
          { line: 5, column: 15 },
        ],
      },
    ]);
  });

  it('rejects directive definitions that recurse through an existing enum value AST node', () => {
    const enumTypeDefinition = parse(`enum Enum { VALUE @a }`, {
      noLocation: true,
    }).definitions[0] as EnumTypeDefinitionNode;
    const schema = new GraphQLSchema({
      types: [
        new GraphQLEnumType({
          name: 'Enum',
          values: {
            VALUE: { astNode: enumTypeDefinition.values?.[0] },
          },
        }),
      ],
      assumeValid: true,
    });

    expectErrors(
      `
        directive @a(arg: Enum) on ENUM_VALUE
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "Enum", "Enum.VALUE", directive application "@a".',
        locations: [
          { line: 2, column: 22 },
          { line: 2, column: 27 },
        ],
      },
    ]);
  });

  it('rejects directive cycles after reaching the type from another directive', () => {
    expectErrors(`
      directive @entry(arg: InputObject) on FIELD_DEFINITION
      directive @cycle(arg: InputObject) on INPUT_FIELD_DEFINITION

      input InputObject {
        value: String @cycle
      }
    `).toDeepEqual([
      {
        message:
          'Directive "@cycle" forms a reference cycle through: "@cycle(arg:)", "InputObject", "InputObject.value", directive application "@cycle".',
        locations: [
          { line: 3, column: 24 },
          { line: 3, column: 29 },
          { line: 6, column: 9 },
          { line: 6, column: 23 },
        ],
      },
    ]);
  });

  it('ignores directive cycles already present in the existing schema', () => {
    const schema = buildSchema(
      `
        directive @cycle(arg: InputObject) on INPUT_FIELD_DEFINITION
        input InputObject {
          value: String @cycle
        }
      `,
      { assumeValidSDL: true },
    );

    expectValid(
      `
        directive @unrelated on FIELD_DEFINITION
      `,
      schema,
    );
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
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", "InputObject.recursive", directive application "@a".',
        locations: [
          { line: 3, column: 11 },
          { line: 3, column: 29 },
        ],
      },
    ]);
  });

  it('rejects type extensions that create cycles with existing directives without AST nodes', () => {
    const inputObject = new GraphQLInputObjectType({
      name: 'InputObject',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      directives: [
        new GraphQLDirective({
          name: 'a',
          locations: [DirectiveLocation.INPUT_FIELD_DEFINITION],
          args: {
            arg: { type: inputObject },
          },
        }),
      ],
      types: [inputObject],
      assumeValid: true,
    });

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
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", "InputObject.recursive", directive application "@a".',
        locations: [
          { line: 3, column: 11 },
          { line: 3, column: 29 },
        ],
      },
    ]);
  });

  it('rejects type extensions that create cycles through linked existing input object types without AST nodes', () => {
    const nestedInput = new GraphQLInputObjectType({
      name: 'NestedInput',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const inputObject = new GraphQLInputObjectType({
      name: 'InputObject',
      fields: {
        nested: { type: nestedInput },
      },
    });
    const schema = new GraphQLSchema({
      directives: [
        new GraphQLDirective({
          name: 'a',
          locations: [DirectiveLocation.INPUT_FIELD_DEFINITION],
          args: {
            arg: { type: inputObject },
          },
        }),
      ],
      types: [inputObject, nestedInput],
      assumeValid: true,
    });

    expectErrors(
      `
        extend input NestedInput {
          recursive: String @a
        }
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", "InputObject.nested", "NestedInput", "NestedInput.recursive", directive application "@a".',
        locations: [
          { line: 3, column: 11 },
          { line: 3, column: 29 },
        ],
      },
    ]);
  });

  it('rejects directives on directive definitions when the syntax exists', () => {
    expectErrors(`
      directive @a @b on DIRECTIVE_DEFINITION
      directive @b @a on DIRECTIVE_DEFINITION
    `).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: directive application "@b", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
          { line: 3, column: 20 },
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
      { noLocation: true },
    );

    expectErrors(
      `
        extend directive @a @b
        extend directive @b @a
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: directive application "@b", directive application "@a".',
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
      { noLocation: true },
    );

    expectErrors(
      `
        extend directive @b @a
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: directive application "@b", directive application "@a".',
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
      { noLocation: true },
    );

    expectErrors(
      `
        extend directive @b @a
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: directive application "@b", directive application "@a".',
        locations: [{ line: 2, column: 29 }],
      },
    ]);
  });

  it('rejects cycles through existing directive extension AST nodes', () => {
    const directiveExtension = parse(`extend directive @existing @cycle`, {
      noLocation: true,
    }).definitions[0] as DirectiveExtensionNode;
    const schema = new GraphQLSchema({
      directives: [
        new GraphQLDirective({
          name: 'existing',
          locations: [DirectiveLocation.ARGUMENT_DEFINITION],
          extensionASTNodes: [directiveExtension],
        }),
      ],
      assumeValid: true,
    });

    expectErrors(
      `
        directive @cycle(arg: String @existing) on ARGUMENT_DEFINITION
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Directive "@existing" forms a reference cycle through: directive application "@cycle", "@cycle(arg:)", directive application "@existing".',
        locations: [
          { line: 2, column: 26 },
          { line: 2, column: 38 },
        ],
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
    ).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", "InputObject.field", directive application "@b", directive application "@a".',
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
    ).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", directive application "@b", directive application "@a".',
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
    ).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", "InputObject.field", directive application "@b", directive application "@a".',
        locations: [{ line: 2, column: 29 }],
      },
    ]);
  });
});
