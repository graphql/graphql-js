// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { createHook } from 'node:async_hooks';
import { describe, it } from 'node:test';

import { expect } from 'chai';

import { parse } from '../../language/parser.ts';

import type { GraphQLFieldConfigMap } from '../../type/definition.ts';
import { GraphQLList, GraphQLObjectType } from '../../type/definition.ts';
import { GraphQLInt } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';

import { execute } from '../execute.ts';

const listSize = 100;

async function executeAndCountPromises(
  syncFieldCount: number,
  asyncFieldCount: number,
): Promise<number> {
  const itemFields: GraphQLFieldConfigMap<unknown, unknown> = {};
  const item: { [key: string]: number } = {};
  const fieldNames: Array<string> = [];
  for (let i = 0; i < syncFieldCount; ++i) {
    itemFields[`sync${i}`] = { type: GraphQLInt };
    item[`sync${i}`] = i;
    fieldNames.push(`sync${i}`);
  }
  for (let i = 0; i < asyncFieldCount; ++i) {
    itemFields[`async${i}`] = {
      type: GraphQLInt,
      resolve: () => Promise.resolve(i),
    };
    fieldNames.push(`async${i}`);
  }

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        items: {
          type: new GraphQLList(
            new GraphQLObjectType({ name: 'Item', fields: itemFields }),
          ),
        },
      },
    }),
  });
  const document = parse(`{ items { ${fieldNames.join(' ')} } }`);
  const rootValue = { items: Array.from({ length: listSize }, () => item) };

  let promiseCount = 0;
  const hook = createHook({
    init(_asyncId, type) {
      if (type === 'PROMISE') {
        ++promiseCount;
      }
    },
  });

  let result;
  hook.enable();
  try {
    result = await execute({ schema, document, rootValue });
  } finally {
    hook.disable();
  }

  const items = (result as any).data.items;
  expect(items).to.have.lengthOf(listSize);
  expect(Object.keys(items[0])).to.deep.equal(fieldNames);
  expect(items[0][`sync${syncFieldCount - 1}`]).to.equal(syncFieldCount - 1);
  expect(items[0][`async${asyncFieldCount - 1}`]).to.equal(asyncFieldCount - 1);

  return promiseCount;
}

describe('Execute: promise creation', () => {
  it('does not wrap synchronous fields of objects with async fields', async () => {
    const promiseCount = await executeAndCountPromises(100, 1);

    // Wrapping each synchronous field value in Promise.all would cost about
    // two promises per field, i.e. more than listSize * 100 * 2 in total.
    expect(promiseCount).to.be.lessThan(listSize * 20);
  });

  it('creates promises in proportion to async fields, not total fields', async () => {
    const fewSyncFields = await executeAndCountPromises(10, 1);
    const manySyncFields = await executeAndCountPromises(100, 1);
    const moreAsyncFields = await executeAndCountPromises(10, 5);

    // 10x more synchronous fields must not come close to doubling the count.
    expect(manySyncFields).to.be.lessThan(fewSyncFields * 2);
    expect(moreAsyncFields).to.be.greaterThan(fewSyncFields);
  });
});
