/* eslint-disable import/unambiguous */
/* eslint-disable import/no-commonjs */
/* eslint-disable no-undef */
const { isObjectType } = require('graphql');

class FakeGraphQLObjectType {
  get [Symbol.toStringTag]() {
    return 'GraphQLObjectType';
  }
}

describe('Jest development mode tests', () => {
  test('isObjectType should throw in development mode for instances from another realm/module', () => {
    expect(() => isObjectType(new FakeGraphQLObjectType())).toThrowError(
      /from another module or realm/,
    );
  });
});
