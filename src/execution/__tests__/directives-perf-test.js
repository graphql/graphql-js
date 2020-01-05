// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import { GraphQLSchema } from '../../type/schema';
import { GraphQLString } from '../../type/scalars';
import { GraphQLObjectType } from '../../type/definition';

import { execute } from '../execute';
import { forAwaitEach, isAsyncIterable } from 'iterall';

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'TestType',
    fields: {
      a: { type: GraphQLString },
      b: { type: GraphQLString },
    },
  }),
});

let count = 0;

const rootValue = {
  a() {
    return 'a';
  },
  b() {
    count += 1;
    return `b${count}`;
  },
};

function executeTestQuery(query) {
  const document = parse(query);
  return execute({ schema, document, rootValue });
}

it('perfomance test, if the same field is deferred several times, its resolve is called only once', async () => {
  const index = 100;
  let fragString = '';
  let fragElementString = '';
  for (const i of Array.from(Array(index).keys())) {
    fragString += `
    ...Frag${i} @defer(label: \"Frag_b_defer${i}\")
    `;
    fragElementString += `
    fragment Frag${i} on TestType {
          b
        }
        `;
  }
  const result = await executeTestQuery(`
        query {
          a
          ${fragString}
        }
        ${fragElementString}
      `);
  expect(isAsyncIterable(result)).to.equal(true);
  const results = [];
  await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
    results.push(value);
  });

  expect(results.length).to.equal(index + 1);
  expect(results[0]).to.deep.equal({
    data: { a: 'a' },
  });
  for (const i of Array.from(Array(index).keys())) {
    expect(results[i + 1]).to.deep.equal({
      data: { b: 'b1' },
      label: `Frag_b_defer${i}`,
      path: [],
    });
  }
});
