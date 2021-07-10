const {
  GraphQLString,
  GraphQLSchema,
  GraphQLObjectType,
} = require('graphql/type');
const { ExecutionResult } = require('graphql/execution');
const { graphqlSync } = require('graphql');

const queryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    sayHi: {
      type: GraphQLString,
      args: {
        who: { type: GraphQLString },
      },
      resolve: (_root, args) => 'Hello ' + (args.who || 'World'),
    },
  },
});

const schema = new GraphQLSchema({
  query: queryType,
});

const { data } = graphqlSync({
  schema,
  source: `
    query helloWho($who: String){
      sayHi(who: $who)
    }
  `,
  variableValues: { who: 'Dolly' },
});

document.getElementById('main').innerHTML = data.sayHi;
