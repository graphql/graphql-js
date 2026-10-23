import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON';

import { parse } from '../../language/parser';

import { GraphQLList, GraphQLObjectType } from '../../type/definition';
import { GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { executeSync } from '../execute';

// A recursive type that allows arbitrary nesting: { nest { nest { ... } } }
const NestType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Nest',
  fields: () => ({
    value: { type: GraphQLString },
    nest: { type: NestType },
    items: { type: new GraphQLList(NestType) },
  }),
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      nest: { type: NestType },
      value: { type: GraphQLString },
    },
  }),
});

function nestData(depth: number): unknown {
  if (depth <= 0) {
    return { value: 'leaf', nest: null, items: [] };
  }
  return {
    value: `depth-${depth}`,
    nest: () => nestData(depth - 1),
    items: () => [nestData(depth - 1)],
  };
}

describe('Execute: maxDepth option', () => {
  it('allows queries within the depth limit', () => {
    const document = parse(`
      {
        nest {
          nest {
            value
          }
        }
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: nestData(3),
      options: { maxDepth: 4 },
    });

    expect(result.errors).to.equal(undefined);
    expect(result.data).to.deep.equal({
      nest: { nest: { value: 'depth-1' } },
    });
  });

  it('returns error when query exceeds depth limit', () => {
    const document = parse(`
      {
        nest {
          nest {
            nest {
              value
            }
          }
        }
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: nestData(5),
      options: { maxDepth: 3 },
    });

    // The error propagates up to the parent field (nest at depth 3)
    // which gets null'd out because the child field (value) at depth 4
    // exceeds the limit.
    expectJSON(result).toDeepEqual({
      data: { nest: { nest: { nest: null } } },
      errors: [
        {
          message: 'Query depth limit of 3 exceeded, found depth: 4.',
          locations: [{ line: 6, column: 15 }],
          path: ['nest', 'nest', 'nest'],
        },
      ],
    });
  });

  it('does not apply depth limit when option is not set', () => {
    const document = parse(`
      {
        nest {
          nest {
            nest {
              nest {
                value
              }
            }
          }
        }
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: nestData(10),
    });

    expect(result.errors).to.equal(undefined);
    expect(result.data).to.deep.equal({
      nest: { nest: { nest: { nest: { value: 'depth-6' } } } },
    });
  });

  it('depth limit of 1 allows only root fields', () => {
    const document = parse(`
      {
        value
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: { value: 'root' },
      options: { maxDepth: 1 },
    });

    expect(result.errors).to.equal(undefined);
    expect(result.data).to.deep.equal({ value: 'root' });
  });

  it('depth limit of 1 rejects nested fields', () => {
    const document = parse(`
      {
        nest {
          value
        }
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: nestData(3),
      options: { maxDepth: 1 },
    });

    // The error at depth 2 (value) propagates up and null's the parent (nest)
    expectJSON(result).toDeepEqual({
      data: { nest: null },
      errors: [
        {
          message: 'Query depth limit of 1 exceeded, found depth: 2.',
          locations: [{ line: 4, column: 11 }],
          path: ['nest'],
        },
      ],
    });
  });

  it('does not count list indices as depth', () => {
    const document = parse(`
      {
        nest {
          items {
            value
          }
        }
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: {
        nest: {
          items: [{ value: 'a' }, { value: 'b' }],
        },
      },
      // depth: query(1) -> nest(2) -> items(3) -> [index] -> value(4)
      // list indices should NOT count, so value is at depth 4
      options: { maxDepth: 4 },
    });

    expect(result.errors).to.equal(undefined);
    expect(result.data).to.deep.equal({
      nest: { items: [{ value: 'a' }, { value: 'b' }] },
    });
  });
});

describe('Execute: maxAliases option', () => {
  it('allows queries within the alias limit', () => {
    const document = parse(`
      {
        a: value
        b: value
        c: value
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: { value: 'ok' },
      options: { maxAliases: 3 },
    });

    expect(result.errors).to.equal(undefined);
    expect(result.data).to.deep.equal({ a: 'ok', b: 'ok', c: 'ok' });
  });

  it('returns error when root aliases exceed limit', () => {
    const document = parse(`
      {
        a: value
        b: value
        c: value
        d: value
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: { value: 'ok' },
      options: { maxAliases: 3 },
    });

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message: 'Aliases limit of 3 exceeded, found 4 aliases.',
          locations: [
            { line: 3, column: 9 },
            { line: 4, column: 9 },
            { line: 5, column: 9 },
            { line: 6, column: 9 },
          ],
        },
      ],
    });
  });

  it('returns error when nested aliases exceed limit', () => {
    const document = parse(`
      {
        nest {
          a: value
          b: value
          c: value
          d: value
        }
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: nestData(3),
      options: { maxAliases: 3 },
    });

    expectJSON(result).toDeepEqual({
      data: { nest: null },
      errors: [
        {
          message: 'Aliases limit of 3 exceeded, found 4 aliases.',
          locations: [
            { line: 4, column: 11 },
            { line: 5, column: 11 },
            { line: 6, column: 11 },
            { line: 7, column: 11 },
          ],
          path: ['nest'],
        },
      ],
    });
  });

  it('does not apply alias limit when option is not set', () => {
    const document = parse(`
      {
        a: value
        b: value
        c: value
        d: value
        e: value
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: { value: 'ok' },
    });

    expect(result.errors).to.equal(undefined);
    expect(result.data).to.deep.equal({
      a: 'ok',
      b: 'ok',
      c: 'ok',
      d: 'ok',
      e: 'ok',
    });
  });

  it('counts non-aliased fields toward the limit', () => {
    // Even without explicit aliases, each unique response key counts.
    const document = parse(`
      {
        value
        nest {
          value
        }
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: nestData(3),
      options: { maxAliases: 2 },
    });

    expect(result.errors).to.equal(undefined);
    expect(result.data).to.deep.equal({
      value: 'depth-3',
      nest: { value: 'depth-2' },
    });
  });

  it('both limits can be used together', () => {
    const document = parse(`
      {
        a: value
        b: value
        nest {
          nest {
            nest {
              value
            }
          }
        }
      }
    `);

    const result = executeSync({
      schema,
      document,
      rootValue: nestData(5),
      options: { maxDepth: 3, maxAliases: 5 },
    });

    // Alias check passes (3 root keys: a, b, nest), but depth check fails
    // at nest.nest.nest.value (depth 4 > maxDepth 3). The error propagates
    // up to the parent field (nest at depth 3) which gets null'd out.
    expectJSON(result).toDeepEqual({
      data: {
        a: 'depth-5',
        b: 'depth-5',
        nest: { nest: { nest: null } },
      },
      errors: [
        {
          message: 'Query depth limit of 3 exceeded, found depth: 4.',
          locations: [{ line: 8, column: 15 }],
          path: ['nest', 'nest', 'nest'],
        },
      ],
    });
  });
});
