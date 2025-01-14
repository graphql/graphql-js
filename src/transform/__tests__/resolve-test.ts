import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser.js';

import type { GraphQLFieldConfig } from '../../type/definition.js';
import { GraphQLObjectType } from '../../type/definition.js';
import { GraphQLInt, GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { executeSync } from './execute.js';

describe('Execute: resolve function', () => {
  function testSchema(testField: GraphQLFieldConfig<any, any>) {
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
    const result = executeSync({
      schema: testSchema({ type: GraphQLString }),
      document: parse('{ test }'),
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

    const result = executeSync({
      schema: testSchema({ type: GraphQLString }),
      document: parse('{ test }'),
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

      constructor(num: number) {
        this._num = num;
      }

      test(args: { addend1: number }, context: { addend2: number }) {
        return this._num + args.addend1 + context.addend2;
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
    const document = parse('{ test(addend1: 80) }');

    const result = executeSync({ schema, document, rootValue, contextValue });
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

    function executeQuery(query: string, rootValue?: unknown) {
      const document = parse(query);
      return executeSync({ schema, document, rootValue });
    }

    expect(executeQuery('{ test }')).to.deep.equal({
      data: {
        test: '[null,{}]',
      },
    });

    expect(executeQuery('{ test }', 'Source!')).to.deep.equal({
      data: {
        test: '["Source!",{}]',
      },
    });

    expect(executeQuery('{ test(aStr: "String!") }', 'Source!')).to.deep.equal({
      data: {
        test: '["Source!",{"aStr":"String!"}]',
      },
    });

    expect(
      executeQuery('{ test(aInt: -123, aStr: "String!") }', 'Source!'),
    ).to.deep.equal({
      data: {
        test: '["Source!",{"aStr":"String!","aInt":-123}]',
      },
    });
  });
});
