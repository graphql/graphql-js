import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { DirectiveLocation } from '../../../language/directiveLocation.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLNonNull, GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLDirective } from '../../../type/directives.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { ProvidedRequiredArgumentsASTVisitor } from '../ProvidedRequiredArgumentsRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr, {
    experimentalFragmentArguments: true,
    noLocation: true,
  });
  const errors = validateWithRules({
    documentAST: doc,
    rules: [ProvidedRequiredArgumentsASTVisitor],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: ProvidedRequiredArgumentsRule', () => {
  it('rejects missing required SDL directive arguments', () => {
    expectSDLErrors(`
      directive @tag(req: String!) on OBJECT

      type Query @tag {
        field: String
      }

      scalar Url @specifiedBy
    `).toDeepEqual([
      {
        message:
          'Argument "@tag(req:)" of type "String!" is required, but it was not provided.',
      },
      {
        message:
          'Argument "@specifiedBy(url:)" of type "String!" is required, but it was not provided.',
      },
    ]);
  });

  it('uses the last duplicate SDL directive definition required argument candidate', () => {
    expectSDLErrors(`
      directive @tag(first: String!) on OBJECT
      directive @tag(second: String!) on OBJECT

      type Query @tag {
        field: String
      }
    `).toDeepEqual([
      {
        message:
          'Argument "@tag(second:)" of type "String!" is required, but it was not provided.',
      },
    ]);
  });

  it('uses later SDL directive definitions when checking required arguments', () => {
    expectSDLErrors(`
      type Query @tag {
        field: String
      }

      directive @tag(req: String!) on OBJECT
    `).toDeepEqual([
      {
        message:
          'Argument "@tag(req:)" of type "String!" is required, but it was not provided.',
      },
    ]);
  });

  it('ignores required SDL directive arguments with invalid input types', () => {
    expectSDLErrors(`
      type Output {
        field: String
      }

      directive @bad(req: Output!, missing: Missing!) on OBJECT

      type Query @bad {
        field: String
      }
    `).toDeepEqual([]);
  });

  it('ignores SDL directives without required arguments', () => {
    expectSDLErrors(`
      directive @marker on OBJECT

      type Query @marker @unknown {
        field: String
      }
    `).toDeepEqual([]);
  });

  it('validates executable field, fragment, and directive required arguments', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: {
              req: { type: new GraphQLNonNull(GraphQLString) },
              opt: { type: GraphQLString },
            },
          },
          noArgs: { type: GraphQLString },
        },
      }),
      directives: [
        new GraphQLDirective({
          name: 'tag',
          locations: [
            DirectiveLocation.QUERY,
            DirectiveLocation.VARIABLE_DEFINITION,
            DirectiveLocation.FIELD,
            DirectiveLocation.FRAGMENT_SPREAD,
            DirectiveLocation.INLINE_FRAGMENT,
            DirectiveLocation.FRAGMENT_DEFINITION,
          ],
          args: {
            req: { type: new GraphQLNonNull(GraphQLString) },
          },
        }),
      ],
    });
    const doc = parse(
      `
        query Test($v: String @tag) @tag {
          field @tag
          noArgs
          ...Frag @tag
          ... on Query @tag {
            field(req: "ok")
          }
        }

        fragment Frag($arg: String!) on Query @tag {
          field(req: "ok")
        }
      `,
      { experimentalFragmentArguments: true, noLocation: true },
    );

    expectJSON(
      validateWithRules({
        documentAST: doc,
        rules: [ProvidedRequiredArgumentsASTVisitor],
        schema,
      }),
    ).toDeepEqual([
      {
        message:
          'Argument "@tag(req:)" of type "String!" is required, but it was not provided.',
      },
      {
        message:
          'Argument "@tag(req:)" of type "String!" is required, but it was not provided.',
      },
      {
        message:
          'Argument "@tag(req:)" of type "String!" is required, but it was not provided.',
      },
      {
        message:
          'Argument "Query.field(req:)" of type "String!" is required, but it was not provided.',
      },
      {
        message:
          'Argument "@tag(req:)" of type "String!" is required, but it was not provided.',
      },
      {
        message:
          'Fragment "Frag" argument "arg" of type "String!" is required, but it was not provided.',
      },
      {
        message:
          'Argument "@tag(req:)" of type "String!" is required, but it was not provided.',
      },
      {
        message:
          'Argument "@tag(req:)" of type "String!" is required, but it was not provided.',
      },
    ]);
  });

  it('validates required field arguments from SDL definitions', () => {
    expectSDLErrors(`
      type Output {
        field: String
      }

      type Query {
        field(req: String!, opt: String): String
        invalid(req: Output!): String
      }

      query {
        field
        field(req: "ok")
        invalid
        unknown
        ...Missing
        ...MissingTypeArg
      }

      fragment MissingTypeArg($arg: Missing!) on Query {
        field(req: "ok")
      }
    `).toDeepEqual([
      {
        message:
          'Argument "Query.field(req:)" of type "String!" is required, but it was not provided.',
      },
      {
        message:
          'Fragment "MissingTypeArg" argument "arg" of type "Missing!" is required, but it was not provided.',
      },
    ]);
  });

  it('accepts provided SDL directive arguments from an existing schema', () => {
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: { field: { type: GraphQLString } },
    });
    const tagDirective = new GraphQLDirective({
      name: 'tag',
      locations: [DirectiveLocation.OBJECT],
      args: {
        req: { type: new GraphQLNonNull(GraphQLString) },
      },
    });
    const schema = new GraphQLSchema({
      query: Query,
      directives: [tagDirective],
    });

    expectSDLErrors(
      `
        extend type Query @tag(req: "ok") {
          other: String
        }
      `,
      schema,
    ).toDeepEqual([]);
  });

  it('ignores existing schema directive arguments with invalid input types while validating SDL', () => {
    const Output = new GraphQLObjectType({
      name: 'Output',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: { field: { type: GraphQLString } },
    });
    const badDirective = new GraphQLDirective({
      name: 'bad',
      locations: [DirectiveLocation.OBJECT],
      args: {
        // @ts-expect-error Testing defensive validation of invalid config.
        req: { type: new GraphQLNonNull(Output) },
      },
    });
    const schema = new GraphQLSchema({
      query: Query,
      directives: [badDirective],
    });

    expectSDLErrors(
      `
        extend type Query @bad {
          other: String
        }
      `,
      schema,
    ).toDeepEqual([]);
  });
});
