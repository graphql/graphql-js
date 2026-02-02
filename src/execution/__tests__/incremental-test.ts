import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { parse } from '../../language/parser.js';

import {
  GraphQLDeferDirective,
  GraphQLList,
  GraphQLObjectType,
  GraphQLStreamDirective,
  GraphQLString,
} from '../../type/index.js';
import { GraphQLSchema } from '../../type/schema.js';

import { execute } from '../execute.js';

describe('Original execute errors on experimental @defer and @stream directives', () => {
  it('errors when using original execute with schemas including experimental @defer directive', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        },
      }),
      directives: [GraphQLDeferDirective],
    });
    const document = parse('query Q { a }');

    expect(() => execute({ schema, document })).to.throw(
      'The provided schema unexpectedly contains experimental directives (@defer or @stream). These directives may only be utilized if experimental execution features are explicitly enabled.',
    );
  });

  it('errors when using original execute with schemas including experimental @stream directive', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Q',
        fields: {
          a: { type: GraphQLString },
        },
      }),
      directives: [GraphQLStreamDirective],
    });
    const document = parse('query Q { a }');

    expect(() => execute({ schema, document })).to.throw(
      'The provided schema unexpectedly contains experimental directives (@defer or @stream). These directives may only be utilized if experimental execution features are explicitly enabled.',
    );
  });

  it('original execute function throws error if anything is deferred and everything else is sync', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          hero: {
            type: new GraphQLObjectType({
              name: 'Hero',
              fields: {
                id: { type: GraphQLString },
              },
            }),
          },
        },
      }),
    });
    const doc = `
      query Deferred {
        ... @defer { hero { id } }
      }
    `;
    expect(() =>
      execute({
        schema,
        document: parse(doc),
        rootValue: {},
      }),
    ).to.throw(
      'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)',
    );
  });

  it('original execute function resolves to error if anything is deferred and something else is async', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          hero: {
            type: new GraphQLObjectType({
              name: 'Hero',
              fields: {
                id: { type: GraphQLString },
              },
            }),
          },
        },
      }),
    });
    const doc = `
      query Deferred {
        hero { name ... @defer { id } }
      }
    `;
    await expectPromise(
      execute({
        schema,
        document: parse(doc),
        rootValue: {
          hero: Promise.resolve({
            id: '1',
            name: async () => {
              await resolveOnNextTick();
              return 'slow';
            },
          }),
        },
      }),
    ).toRejectWith(
      'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)',
    );
  });

  it('original execute function throws error if anything is streamed and everything else is sync', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          scalarList: { type: new GraphQLList(GraphQLString) },
          friendList: {
            type: new GraphQLList(
              new GraphQLObjectType({
                name: 'Friend',
                fields: {
                  name: { type: GraphQLString },
                },
              }),
            ),
          },
        },
      }),
    });
    const doc = `
      query {
        scalarList
        friendList @stream { name }
      }
    `;
    expect(() =>
      execute({
        schema,
        document: parse(doc),
        rootValue: {
          scalarList: ['apple', 'banana', 'coconut'],
          friendList: [{ name: 'Alice' }, { name: 'Bob' }],
        },
      }),
    ).to.throw(
      'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)',
    );
  });
  it('original execute function resolves to error if anything is streamed and something else is async', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          scalarList: { type: new GraphQLList(GraphQLString) },
          friendList: {
            type: new GraphQLList(
              new GraphQLObjectType({
                name: 'Friend',
                fields: {
                  name: { type: GraphQLString },
                },
              }),
            ),
          },
        },
      }),
    });
    const doc = `
      query {
        scalarList
        friendList @stream { name }
      }
    `;
    await expectPromise(
      execute({
        schema,
        document: parse(doc),
        rootValue: {
          scalarList: Promise.resolve(['apple', 'banana', 'coconut']),
          friendList: [{ name: 'Alice' }, { name: 'Bob' }],
        },
      }),
    ).toRejectWith(
      'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)',
    );
  });
});
