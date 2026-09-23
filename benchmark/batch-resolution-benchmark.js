import { execute } from 'graphql/execution/execute.js';
import { parse } from 'graphql/language/parser.js';
import {
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql/type/index.js';

const WidgetType = new GraphQLObjectType({
  name: 'Widget',
  fields: () => ({
    id: { type: GraphQLID },
    widget: {
      type: WidgetType,
      resolve: async (source) => {
        await Promise.resolve();
        return source.widget;
      },
      experimentalBatchResolve: async (sources) => {
        await Promise.resolve();
        return sources.map((source) => source.widget);
      },
    },
    widgets: { type: new GraphQLList(WidgetType) },
  }),
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    widgets: {
      type: new GraphQLList(WidgetType),
      args: { first: { type: GraphQLInt } },
      resolve: (source, args) => source.widgets.slice(0, args.first),
    },
  },
});

const schema = new GraphQLSchema({ query: QueryType });

const rootValue = {
  widgets: Array.from({ length: 10000 }, () => ({
    id: 'gid://owner/Widget/1',
    widget: { id: 'gid://owner/Widget/1' },
  })),
};
const document = parse(`{ widgets(first: 10000) { id widget { id } } }`);

export const benchmark = {
  name: 'Execute Async Widget Field With Batch Resolver',
  measure: () =>
    execute({
      schema,
      document,
      rootValue,
      enableBatchResolvers: true,
    }),
};
