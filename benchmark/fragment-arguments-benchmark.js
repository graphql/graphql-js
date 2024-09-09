import { execute } from 'graphql/execution/execute.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

const schema = buildSchema('type Query { field(echo: String!): [String] }');

const integers = Array.from({ length: 100 }, (_, i) => i + 1);

const document = parse(
  `
    query WithManyFragmentArguments(${integers
      .map((i) => `$echo${i}: String`)
      .join(', ')}) {
      ${integers.map((i) => `echo${i}: field(echo: $echo${i})`).join('\n')}
      ${integers.map((i) => `...EchoFragment${i}(echo: $echo${i})`).join('\n')}
    }

    ${integers
      .map(
        (i) =>
          `fragment EchoFragment${i}($echo: String) on Query { echoFragment${i}: field(echo: $echo) }`,
      )
      .join('\n')}
  `,
  { experimentalFragmentArguments: true },
);

const variableValues = Object.create(null);
for (const i of integers) {
  variableValues[`echo${i}`] = `Echo ${i}`;
}

function field(_, args) {
  return args.echo;
}

export const benchmark = {
  name: 'Execute Operation with Fragment Arguments',
  count: 10,
  async measure() {
    await execute({
      schema,
      document,
      rootValue: { field },
      variableValues,
    });
  },
};
