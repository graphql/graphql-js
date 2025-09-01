import { isObjectType } from 'graphql';

class GraphQLObjectType {
  get [Symbol.toStringTag]() {
    return 'GraphQLObjectType';
  }
}

try {
  isObjectType(new GraphQLObjectType());
  throw new Error(
    'Expected isObjectType to throw an error in Rollup development mode.',
  );
} catch (error) {
  if (!error.message.includes('from another module or realm')) {
    throw error;
  }
}
