import { isObjectType } from 'graphql';

class GraphQLObjectType {
  get [Symbol.toStringTag]() {
    return 'GraphQLObjectType';
  }
}

const result = isObjectType(new GraphQLObjectType());
if (result !== false) {
  throw new Error('isObjectType should return false in Bun production mode.');
}
