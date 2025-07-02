import { isObjectType } from 'graphql';
// eslint-disable-next-line n/no-missing-import
import { expect, test } from 'vitest';

class FakeGraphQLObjectType {
  get [Symbol.toStringTag]() {
    return 'GraphQLObjectType';
  }
}

test('isObjectType should throw in development mode for instances from another realm/module', () => {
  expect(() => isObjectType(new FakeGraphQLObjectType())).toThrowError(
    /from another module or realm/,
  );
});
