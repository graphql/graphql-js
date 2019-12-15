// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { GraphQLSchema } from '../../type/schema';
import { GraphQLObjectType } from '../../type/definition';
import { GraphQLInt, GraphQLString } from '../../type/scalars';

import { graphqlSync } from '../../graphql';

describe('Execute: resolve function', () => {
  function testSchema(testField) {
    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          test: testField,
        },
      }),
    });
  }

  it('default function accesses properties', () => {
    const result = graphqlSync({
      schema: testSchema({ type: GraphQLString }),
      source: '{ test }',
      rootValue: { test: 'testValue' },
    });

    expect(result).to.deep.equal({
      data: {
        test: 'testValue',
      },
    });
  });

  it('default function calls methods', () => {
    const rootValue = {
      _secret: 'secretValue',
      test() {
        return this._secret;
      },
    };

    const result = graphqlSync({
      schema: testSchema({ type: GraphQLString }),
      source: '{ test }',
      rootValue,
    });
    expect(result).to.deep.equal({
      data: {
        test: 'secretValue',
      },
    });
  });

  it('default function passes args and context', () => {
    class Adder {
      _num: number;

      constructor(num) {
        this._num = num;
      }

      test({ addend1 }, context) {
        return this._num + addend1 + context.addend2;
      }
    }
    const rootValue = new Adder(700);

    const schema = testSchema({
      type: GraphQLInt,
      args: {
        addend1: { type: GraphQLInt },
      },
    });
    const contextValue = { addend2: 9 };
    const source = '{ test(addend1: 80) }';

    const result = graphqlSync({ schema, source, rootValue, contextValue });
    expect(result).to.deep.equal({
      data: { test: 789 },
    });
  });

  it('uses provided resolve function', () => {
    const schema = testSchema({
      type: GraphQLString,
      args: {
        aStr: { type: GraphQLString },
        aInt: { type: GraphQLInt },
      },
      resolve: (source, args) => JSON.stringify([source, args]),
    });

    function execute(source, rootValue, contextValue) {
      return graphqlSync({ schema, source, rootValue, contextValue });
    }

    expect(execute('{ test }')).to.deep.equal({
      data: {
        test: '[null,{}]',
      },
    });

    expect(execute('{ test }', 'Source!')).to.deep.equal({
      data: {
        test: '["Source!",{}]',
      },
    });

    expect(execute('{ test(aStr: "String!") }', 'Source!')).to.deep.equal({
      data: {
        test: '["Source!",{"aStr":"String!"}]',
      },
    });

    expect(
      execute('{ test(aInt: -123, aStr: "String!") }', 'Source!'),
    ).to.deep.equal({
      data: {
        test: '["Source!",{"aStr":"String!","aInt":-123}]',
      },
    });
  });
});
