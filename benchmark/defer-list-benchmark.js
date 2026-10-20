import { experimentalExecuteIncrementally } from 'graphql/execution/execute.js';
import { parse } from 'graphql/language/parser.js';
import { GraphQLList, GraphQLObjectType } from 'graphql/type/definition.js';
import {
  GraphQLDeferDirective,
  specifiedDirectives,
} from 'graphql/type/directives.js';
import { GraphQLString } from 'graphql/type/scalars.js';
import { GraphQLSchema } from 'graphql/type/schema.js';

const User = new GraphQLObjectType({
  name: 'User',
  fields: {
    name: { type: GraphQLString },
  },
});

const users = Array.from({ length: 600 }, (_, index) => ({
  name: `User ${index + 1}`,
}));

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      allUsers: {
        type: new GraphQLList(User),
        resolve: () => users,
      },
    },
  }),
  directives: [...specifiedDirectives, GraphQLDeferDirective],
  assumeValid: true,
});

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const labels = [];
for (let i = 0; i < 31; i++) {
  // 17.x.x works with `31` set to `26*26`
  const letter1 = letters[Math.floor(i / 26)];
  const letter2 = letters[i % 26];
  labels.push(`${letter1}${letter2}`);
}

const deferredSpreads = labels
  .map((label) => `      ...A @defer(label: "${label}")`)
  .join('\n');

let leafFields = 'name';
for (let i = 0; i < 20; i++) {
  leafFields += `\n    ${letters[i]}:name`;
}

const documentString = `
  {
    allUsers {
${deferredSpreads}
    }
  }
  fragment A on User {
    ${leafFields}
  }
`;
const document = parse(documentString);

export const benchmark = {
  name: 'Defer in Large List Benchmark',
  measure: async () => {
    const result = await experimentalExecuteIncrementally({
      schema,
      document,
      rootValue: {},
    });
    if ('initialResult' in result) {
      // eslint-disable-next-line no-unused-vars
      for await (const _subsequentResult of result.subsequentResults) {
        // noop
      }
    }
  },
};
