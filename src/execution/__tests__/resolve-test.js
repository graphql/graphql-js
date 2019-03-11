/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

import {
  graphqlSync,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
} from '../../';

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
    const schema = testSchema({ type: GraphQLString });

    const source = {
      test: 'testValue',
    };

    expect(graphqlSync(schema, '{ test }', source)).to.deep.equal({
      data: {
        test: 'testValue',
      },
    });
  });

  it('default function calls methods', () => {
    const schema = testSchema({ type: GraphQLString });

    const source = {
      _secret: 'secretValue',
      test() {
        return this._secret;
      },
    };

    expect(graphqlSync(schema, '{ test }', source)).to.deep.equal({
      data: {
        test: 'secretValue',
      },
    });
  });

  it('default function passes args and context', () => {
    const schema = testSchema({
      type: GraphQLInt,
      args: {
        addend1: { type: GraphQLInt },
      },
    });

    class Adder {
      _num: number;

      constructor(num) {
        this._num = num;
      }

      test({ addend1 }, context) {
        return this._num + addend1 + context.addend2;
      }
    }
    const source = new Adder(700);

    expect(
      graphqlSync(schema, '{ test(addend1: 80) }', source, { addend2: 9 }),
    ).to.deep.equal({
      data: {
        test: 789,
      },
    });
  });

  it('uses provided resolve function', () => {
    const schema = testSchema({
      type: GraphQLString,
      args: {
        aStr: { type: GraphQLString },
        aInt: { type: GraphQLInt },
      },
      resolve(source, args) {
        return JSON.stringify([source, args]);
      },
    });

    expect(graphqlSync(schema, '{ test }')).to.deep.equal({
      data: {
        test: '[null,{}]',
      },
    });

    expect(graphqlSync(schema, '{ test }', 'Source!')).to.deep.equal({
      data: {
        test: '["Source!",{}]',
      },
    });

    expect(
      graphqlSync(schema, '{ test(aStr: "String!") }', 'Source!'),
    ).to.deep.equal({
      data: {
        test: '["Source!",{"aStr":"String!"}]',
      },
    });

    expect(
      graphqlSync(schema, '{ test(aInt: -123, aStr: "String!") }', 'Source!'),
    ).to.deep.equal({
      data: {
        test: '["Source!",{"aStr":"String!","aInt":-123}]',
      },
    });
  });
});
