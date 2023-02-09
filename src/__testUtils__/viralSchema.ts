import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../type/definition.js';
import { GraphQLString } from '../type/scalars.js';
import { GraphQLSchema } from '../type/schema.js';

const Mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    geneSequence: {
      type: new GraphQLNonNull(GraphQLString),
    },
  },
});

const Virus = new GraphQLObjectType({
  name: 'Virus',
  fields: {
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    knownMutations: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Mutation))),
    },
  },
});

const Query = new GraphQLObjectType({
  name: 'Query',
  fields: {
    viruses: {
      type: new GraphQLList(new GraphQLNonNull(Virus)),
    },
  },
});

export const viralSchema = new GraphQLSchema({
  query: Query,
});
