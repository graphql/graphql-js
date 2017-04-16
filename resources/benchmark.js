/**
 * Run benchmark in Terminal:
 *
 *    yarn run t src/__tests__/graphql.benchmark.js
 */

import Benchmark from 'benchmark';
import { describe, it } from 'mocha';

import { StarWarsSchema } from '../src/__tests__/starWarsSchema';
import { parse } from '../src/language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInt,
} from '../src/type';

import { Observable } from 'rxjs/Rx';
import { graphql as graphqlOri } from '../src/graphql-origin';
import { graphql as graphqlRx } from '../src/graphql-rx';
import { graphql as graphqlMost } from '../src/graphql-most';
import { execute as executeOri } from '../src/execution/execute-origin';
import { executeRx } from '../src/execution/execute-rx';
import { executeMost } from  '../src/execution/execute-most';


function runBenchmark(cases = {}, callback = () => {}) {
  const suite = new Benchmark.Suite();
  const benchmarkCases = Object.keys(cases);
  for (const caseName of benchmarkCases) {
    suite.add(caseName, cases[caseName]);
  }

  console.log('');
  suite.on('cycle', function (event) {
    console.log(`      * ${String(event.target)}`);
  })
  .on('complete', function () {
    console.log(`      => Fastest is ${this.filter('fastest').map('name')}`);
    callback(this);
  })
  .run();
}

function verifyAndRunBenchmark(cases = {}) {
  // Ensure the results of tasks are the same before running benchmark.
  const verifyTaskResultsAreTheSame = Observable.pairs(cases)
    .map(([ caseName, task ]) => {
      return Observable.create(async subscriber => {
        const result = await task();
        if (result) {
          subscriber.next([ caseName, result ]);
          subscriber.complete();
        } else {
          subscriber.error(new Error(`Got no result on the benchmark task ${
            caseName}`));
        }
      });
    })
    .combineAll((...totalResults) => {
      const notMatchedResults = [];
      const compareResult = totalResults.reduce((a, b) => {
        const resultA = a[1];
        const resultB = b[1];
        if (JSON.stringify(resultA) !== JSON.stringify(resultB)) {
          notMatchedResults.push(b);
        }
        // Continue using the first result (a) to compare to other results.
        return a;
      });

      if (notMatchedResults.length > 0) {
        const standardCaseName = compareResult[0];
        const standerdResult = JSON.stringify(compareResult[1], null, 2);
        const notMatchedInfo = notMatchedResults.reduce((acc, curr) => {
          return acc + `${curr[0]}: ${JSON.stringify(curr[1], null, 2)}`;
        }, '');
        const error = new Error('Results are not matched to each others.\n' +
          `Standard result (${standardCaseName}): ${standerdResult}\n` +
          'Not matched results:\n' + notMatchedInfo
        );
        return Observable.throw(error);
      }

      return Observable.empty();
    })
    .mergeAll();

  return verifyTaskResultsAreTheSame.toPromise()
    .then(() => {
      // Only passing the verification will run the benchmark.
      runBenchmark(cases);
    });
}

// Copy the serial test from mutations-test.js
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
        }
      },
      promiseToChangeTheNumber: {
        type: numberHolderType,
        args: { newNumber: { type: GraphQLInt } },
        resolve(obj, { newNumber }) {
          return obj.promiseToChangeTheNumber(newNumber);
        }
      },
      failToChangeTheNumber: {
        type: numberHolderType,
        args: { newNumber: { type: GraphQLInt } },
        resolve(obj, { newNumber }) {
          return obj.failToChangeTheNumber(newNumber);
        }
      },
      promiseAndFailToChangeTheNumber: {
        type: numberHolderType,
        args: { newNumber: { type: GraphQLInt } },
        resolve(obj, { newNumber }) {
          return obj.promiseAndFailToChangeTheNumber(newNumber);
        }
      }
    },
    name: 'Mutation',
  })
});


describe('Run Benchmark', function () {

  this.timeout(60000);

  it('compare performance for simple query', function (done) {
    const query = `
      query HeroNameQuery {
        hero {
          name
        }
      }
    `;

    verifyAndRunBenchmark({
      graphqlOri: async () => {
        return await graphqlOri(StarWarsSchema, query);
      },
      graphqlRxToPromise: async () => {
        return await graphqlRx(StarWarsSchema, query).toPromise();
      },
      graphqlMostToPromise: async () => {
        return await graphqlMost(StarWarsSchema, query)
          .take(1).reduce((_, x) => x, undefined);
      }
    })
    .then(done, done);
  });

  it('compare performance for deep query', function (done) {
    const query = `
      query NestedQuery {
        hero {
          name
          friends {
            name
            appearsIn
            friends {
              name
            }
          }
        }
      }
    `;

    verifyAndRunBenchmark({
      graphqlOri: async () => {
        return await graphqlOri(StarWarsSchema, query);
      },
      graphqlRxToPromise: async () => {
        return await graphqlRx(StarWarsSchema, query).toPromise();
      },
      graphqlMostToPromise: async () => {
        return await graphqlMost(StarWarsSchema, query)
          .take(1).reduce((_, x) => x, undefined);
      }
    })
    .then(done, done);
  });

  it('compare performance for serial mutation', function (done) {
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
    const documentAST = parse(doc);
    verifyAndRunBenchmark({
      graphqlOri: async () => {
        return await executeOri(schema, documentAST, new Root(6));
      },
      graphqlRxToPromise: async () => {
        return await executeRx(schema, documentAST, new Root(6)).toPromise();
      },
      graphqlMostToPromise: async () => {
        return await executeMost(schema, documentAST, new Root(6))
          .take(1).reduce((_, x) => x, undefined);
      }
    })
    .then(done, done);
  });

});

