import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import { parse } from '../../language/parser.js';

import type { GraphQLSchema } from '../../type/schema.js';
import { validateSchema } from '../../type/validate.js';

import { validate } from '../../validation/validate.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { execute } from '../execute.js';

async function executeQuery(args: {
  schema: GraphQLSchema;
  query: string;
  rootValue?: unknown;
}) {
  const { schema, query, rootValue } = args;
  const document = parse(query);
  return execute({
    schema,
    document,
    rootValue,
  });
}

describe('Execute: default arguments', () => {
  it('handles interfaces with fields with default arguments', async () => {
    const schema = buildSchema(`
      type Query {
        someInterface: SomeInterface
      }

      interface SomeInterface {
        echo(value: String! = "default"): String
      }

      type SomeType implements SomeInterface {
        echo(value: String!): String
      }
    `);

    const query = `
      {
        someInterface {
          ... on SomeType {
            echo
          }
          echo
        }
      }
    `;

    const schemaErrors = validateSchema(schema);

    expectJSON(schemaErrors).toDeepEqual([]);

    const queryErrors = validate(schema, parse(query));

    expectJSON(queryErrors).toDeepEqual([
      {
        // This fails validation only for the object, but passes for the interface.
        message:
          'Argument "SomeType.echo(value:)" of type "String!" is required, but it was not provided.',
        locations: [{ line: 5, column: 13 }],
      },
    ]);

    const rootValue = {
      someInterface: {
        __typename: 'SomeType',
        echo: 'Runtime error raised, not called!',
      },
    };

    expectJSON(await executeQuery({ schema, query, rootValue })).toDeepEqual({
      data: {
        someInterface: {
          echo: null,
        },
      },
      errors: [
        {
          message:
            'Argument "value" of required type "String!" was not provided.',
          path: ['someInterface', 'echo'],
          locations: [{ line: 5, column: 13 }],
        },
      ],
    });
  });
});
