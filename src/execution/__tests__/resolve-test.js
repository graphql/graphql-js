/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

import {
  graphql,
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
          test: testField
        }
      })
    });
  }

  it('default function accesses properties', async () => {
    const schema = testSchema({ type: GraphQLString });

    const source = {
      test: 'testValue'
    };

    expect(
      await graphql(schema, '{ test }', source)
    ).to.deep.equal({
      data: {
        test: 'testValue'
      }
    });
  });

  it('default function calls methods', async () => {
    const schema = testSchema({ type: GraphQLString });

    const source = {
      _secret: 'secretValue',
      test() {
        return this._secret;
      }
    };

    expect(
      await graphql(schema, '{ test }', source)
    ).to.deep.equal({
      data: {
        test: 'secretValue'
      }
    });
  });

  it('uses provided resolve function', async () => {
    const schema = testSchema({
      type: GraphQLString,
      args: {
        aStr: { type: GraphQLString },
        aInt: { type: GraphQLInt },
      },
      resolve(source, args) {
        return JSON.stringify([ source, args ]);
      }
    });

    expect(
      await graphql(schema, '{ test }')
    ).to.deep.equal({
      data: {
        test: '[null,{}]'
      }
    });

    expect(
      await graphql(schema, '{ test }', 'Source!')
    ).to.deep.equal({
      data: {
        test: '["Source!",{}]'
      }
    });

    expect(
      await graphql(schema, '{ test(aStr: "String!") }', 'Source!')
    ).to.deep.equal({
      data: {
        test: '["Source!",{"aStr":"String!"}]'
      }
    });

    expect(
      await graphql(schema, '{ test(aInt: -123, aStr: "String!") }', 'Source!')
    ).to.deep.equal({
      data: {
        test: '["Source!",{"aStr":"String!","aInt":-123}]'
      }
    });
  });

});
