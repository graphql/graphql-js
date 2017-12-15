/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { execute } from '../execute';
import { parse } from '../../language';
import { GraphQLSchema, GraphQLObjectType, GraphQLInt } from '../../type';

class NumberHolder {
  theNumber: number;

  constructor(originalNumber: number) {
    this.theNumber = originalNumber;
  }
}

class Root {
  numberHolder: NumberHolder;

  constructor(originalNumber: number) {
    this.numberHolder = new NumberHolder(originalNumber);
  }

  immediatelyChangeTheNumber(newNumber: number): NumberHolder {
    this.numberHolder.theNumber = newNumber;
    return this.numberHolder;
  }

  promiseToChangeTheNumber(newNumber: number): Promise<NumberHolder> {
    return new Promise(resolve => {
      process.nextTick(() => {
        resolve(this.immediatelyChangeTheNumber(newNumber));
      });
    });
  }

  failToChangeTheNumber(): NumberHolder {
    throw new Error('Cannot change the number');
  }

  promiseAndFailToChangeTheNumber(): Promise<NumberHolder> {
    return new Promise((resolve, reject) => {
      process.nextTick(() => {
        reject(new Error('Cannot change the number'));
      });
    });
  }
}

const numberHolderType = new GraphQLObjectType({
  fields: {
    theNumber: { type: GraphQLInt },
  },
  name: 'NumberHolder',
});
const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    fields: {
      numberHolder: { type: numberHolderType },
    },
    name: 'Query',
  }),
  mutation: new GraphQLObjectType({
    fields: {
      immediatelyChangeTheNumber: {
        type: numberHolderType,
        args: { newNumber: { type: GraphQLInt } },
        resolve(obj, { newNumber }) {
          return obj.immediatelyChangeTheNumber(newNumber);
        },
      },
      promiseToChangeTheNumber: {
        type: numberHolderType,
        args: { newNumber: { type: GraphQLInt } },
        resolve(obj, { newNumber }) {
          return obj.promiseToChangeTheNumber(newNumber);
        },
      },
      failToChangeTheNumber: {
        type: numberHolderType,
        args: { newNumber: { type: GraphQLInt } },
        resolve(obj, { newNumber }) {
          return obj.failToChangeTheNumber(newNumber);
        },
      },
      promiseAndFailToChangeTheNumber: {
        type: numberHolderType,
        args: { newNumber: { type: GraphQLInt } },
        resolve(obj, { newNumber }) {
          return obj.promiseAndFailToChangeTheNumber(newNumber);
        },
      },
    },
    name: 'Mutation',
  }),
});

describe('Execute: Handles mutation execution ordering', () => {
  it('evaluates mutations serially', async () => {
    const doc = `mutation M {
      first: immediatelyChangeTheNumber(newNumber: 1) {
        theNumber
      },
      second: promiseToChangeTheNumber(newNumber: 2) {
        theNumber
      },
      third: immediatelyChangeTheNumber(newNumber: 3) {
        theNumber
      }
      fourth: promiseToChangeTheNumber(newNumber: 4) {
        theNumber
      },
      fifth: immediatelyChangeTheNumber(newNumber: 5) {
        theNumber
      }
    }`;

    const mutationResult = await execute(schema, parse(doc), new Root(6));

    return expect(mutationResult).to.deep.equal({
      data: {
        first: {
          theNumber: 1,
        },
        second: {
          theNumber: 2,
        },
        third: {
          theNumber: 3,
        },
        fourth: {
          theNumber: 4,
        },
        fifth: {
          theNumber: 5,
        },
      },
    });
  });

  it('evaluates mutations correctly in the presense of a failed mutation', async () => {
    const doc = `mutation M {
      first: immediatelyChangeTheNumber(newNumber: 1) {
        theNumber
      },
      second: promiseToChangeTheNumber(newNumber: 2) {
        theNumber
      },
      third: failToChangeTheNumber(newNumber: 3) {
        theNumber
      }
      fourth: promiseToChangeTheNumber(newNumber: 4) {
        theNumber
      },
      fifth: immediatelyChangeTheNumber(newNumber: 5) {
        theNumber
      }
      sixth: promiseAndFailToChangeTheNumber(newNumber: 6) {
        theNumber
      }
    }`;

    const result = await execute(schema, parse(doc), new Root(6));

    expect(result.data).to.deep.equal({
      first: {
        theNumber: 1,
      },
      second: {
        theNumber: 2,
      },
      third: null,
      fourth: {
        theNumber: 4,
      },
      fifth: {
        theNumber: 5,
      },
      sixth: null,
    });

    expect(result.errors).to.have.length(2);
    expect(result.errors).to.containSubset([
      {
        message: 'Cannot change the number',
        locations: [{ line: 8, column: 7 }],
      },
      {
        message: 'Cannot change the number',
        locations: [{ line: 17, column: 7 }],
      },
    ]);
  });
});
