import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import { Kind } from '../../language/kinds.js';
import { parse } from '../../language/parser.js';

import { GraphQLNonNull, GraphQLObjectType } from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { legacyExecuteIncrementally } from '../legacyExecuteIncrementally.js';

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: { someField: { type: new GraphQLNonNull(GraphQLString) } },
  }),
});

describe('legacyExecuteIncrementally', () => {
  it('handles invalid document', () => {
    const result = legacyExecuteIncrementally({
      schema,
      document: { kind: Kind.DOCUMENT, definitions: [] },
    });

    expectJSON(result).toDeepEqual({
      errors: [
        {
          message: 'Must provide an operation.',
        },
      ],
    });
  });

  it('handles non-nullable root field', () => {
    const result = legacyExecuteIncrementally({
      schema,
      document: parse('{ someField }'),
      rootValue: { someField: null },
    });

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Cannot return null for non-nullable field Query.someField.',
          locations: [{ line: 1, column: 3 }],
          path: ['someField'],
        },
      ],
    });
  });
});
