// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import { GraphQLSchema } from '../../type/schema';
import { GraphQLString } from '../../type/scalars';
import { GraphQLObjectType } from '../../type/definition';

import { execute } from '../execute';
import { forAwaitEach, isAsyncIterable } from 'iterall';

class Data {
  d: string;
  e: string;

  constructor(d) {
    this.d = d;
    this.e = 'e';
  }
}

function delay(t, v) {
  return new Promise(function(resolve) {
    setTimeout(resolve.bind(null, v), t);
  });
}

const DataType = new GraphQLObjectType({
  name: 'DataType',
  fields: {
    d: {
      type: GraphQLString,
      resolve(obj) {
        return delay(5).then(() => obj.d);
      },
    },
    e: {
      type: GraphQLString,
      resolve(obj) {
        return obj.e;
      },
    },
  },
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'TestType',
    fields: {
      a: { type: GraphQLString },
      b: { type: GraphQLString },
      c: { type: DataType },
    },
  }),
});

const rootValue = {
  a() {
    return 'a';
  },
  b() {
    return 'b';
  },
  c() {
    return Promise.resolve(new Data('d'));
  },
};

function executeTestQuery(query) {
  const document = parse(query);
  return execute({ schema, document, rootValue });
}

describe('Execute: handles directives', () => {
  describe('works without directives', () => {
    it('basic query works', () => {
      const result = executeTestQuery('{ a, b }');

      expect(result).to.deep.equal({
        data: { a: 'a', b: 'b' },
      });
    });
  });

  describe('works on scalars', () => {
    it('if true includes scalar', () => {
      const result = executeTestQuery('{ a, b @include(if: true) }');

      expect(result).to.deep.equal({
        data: { a: 'a', b: 'b' },
      });
    });

    it('if false omits on scalar', () => {
      const result = executeTestQuery('{ a, b @include(if: false) }');

      expect(result).to.deep.equal({
        data: { a: 'a' },
      });
    });

    it('unless false includes scalar', () => {
      const result = executeTestQuery('{ a, b @skip(if: false) }');

      expect(result).to.deep.equal({
        data: { a: 'a', b: 'b' },
      });
    });

    it('unless true omits scalar', () => {
      const result = executeTestQuery('{ a, b @skip(if: true) }');

      expect(result).to.deep.equal({
        data: { a: 'a' },
      });
    });
  });

  describe('works on fragment spreads', () => {
    it('if false omits fragment spread', () => {
      const result = executeTestQuery(`
        query {
          a
          ...Frag @include(if: false)
        }
        fragment Frag on TestType {
          b
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a' },
      });
    });

    it('if true includes fragment spread', () => {
      const result = executeTestQuery(`
        query {
          a
          ...Frag @include(if: true)
        }
        fragment Frag on TestType {
          b
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a', b: 'b' },
      });
    });

    it('unless false includes fragment spread', () => {
      const result = executeTestQuery(`
        query {
          a
          ...Frag @skip(if: false)
        }
        fragment Frag on TestType {
          b
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a', b: 'b' },
      });
    });

    it('unless true omits fragment spread', () => {
      const result = executeTestQuery(`
        query {
          a
          ...Frag @skip(if: true)
        }
        fragment Frag on TestType {
          b
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a' },
      });
    });

    describe('defer fragment spread', () => {
      it('without if', async () => {
        const result = await executeTestQuery(`
        query {
          a
          ...Frag @defer(label: "Frag_b_defer")
        }
        fragment Frag on TestType {
          b
        }
      `);
        expect(isAsyncIterable(result)).to.equal(true);
        const results = [];
        await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
          results.push(value);
        });

        expect(results.length).to.equal(2);
        expect(results[0]).to.deep.equal({
          data: { a: 'a' },
        });
        expect(results[1]).to.deep.equal({
          data: { b: 'b' },
          label: 'Frag_b_defer',
          path: [],
        });
      });

      it('if true', async () => {
        const result = await executeTestQuery(`
        query {
          a
          ...Frag @defer(if: true, label: "Frag_b_defer")
        }
        fragment Frag on TestType {
          b
        }
      `);
        expect(isAsyncIterable(result)).to.equal(true);

        const results = [];
        await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
          results.push(value);
        });

        expect(results.length).to.equal(2);
        expect(results[0]).to.deep.equal({
          data: { a: 'a' },
        });
        expect(results[1]).to.deep.equal({
          data: { b: 'b' },
          label: 'Frag_b_defer',
          path: [],
        });
      });

      it('if false', async () => {
        const result = await executeTestQuery(`
        query {
          a
          ...Frag @defer(if: false, label: "Frag_b_defer")
        }
        fragment Frag on TestType {
          b
        }
      `);
        expect(isAsyncIterable(result)).to.equal(false);
        const data = await result;
        expect(data).to.deep.equal({
          data: { a: 'a', b: 'b' },
        });
      });
      describe('defer fragment spread with DataType', () => {
        it('without defer', async () => {
          const result = await executeTestQuery(`
            query {
              a
              ...Frag
            }
            fragment FragData on DataType  {
              d
            }
            fragment Frag on TestType {
              c {
                ...FragData
              }
            }
          `);
          expect(isAsyncIterable(result)).to.equal(false);
          const data = await result;
          expect(data).to.deep.equal({
            data: {
              a: 'a',
              c: {
                d: 'd',
              },
            },
          });
        });

        it('if false not defer', async () => {
          const result = await executeTestQuery(`
            query {
              a
              ...Frag @defer(if: false, label: "Frag_c_defer")
            }
            fragment Frag on TestType {
              c {
                ...FragData @defer(if: false, label: "Frag_d_defer")
              }
            }
            fragment FragData on DataType  {
              d
            }
          `);
          expect(isAsyncIterable(result)).to.equal(false);
          const data = await result;
          expect(data).to.deep.equal({
            data: {
              a: 'a',
              c: {
                d: 'd',
              },
            },
          });
        });
        it('two fragments with two field equals', async () => {
          const result = await executeTestQuery(`
            query {
              a
              ...Frag @defer(if: true, label: "Frag_c_defer")
            }
            fragment Frag on TestType {
              c {
                ...FragData @defer(if: true, label: "FragData_d_defer")
                ...FragDeData @defer(if: true, label: "FragDeData_de_defer")
              }
            }
            fragment FragData on DataType {
              d
            }
            fragment FragDeData on DataType {
              d
              e
            }
          `);
          expect(isAsyncIterable(result)).to.equal(true);

          const results = [];
          await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
            results.push(value);
          });

          expect(results.length).to.equal(4);
          expect(results[0]).to.deep.equal({
            data: { a: 'a' },
          });
          expect(results[1]).to.deep.equal({
            data: {
              c: {},
            },
            label: 'Frag_c_defer',
            path: [],
          });
          expect(results[2]).to.deep.equal({
            data: { d: 'd' },
            label: 'FragData_d_defer',
            path: ['c'],
          });
          expect(results[3]).to.deep.equal({
            data: { d: 'd', e: 'e' },
            label: 'FragDeData_de_defer',
            path: ['c'],
          });
        });

        it('race condition', async () => {
          const result = await executeTestQuery(`
            query {
              a
              ...Frag @defer(if: true, label: "Frag_c_defer")
            }
            fragment Frag on TestType {
              c {
                ...FragData @defer(if: true, label: "FragData_d_defer")
                ...FragDeData @defer(if: true, label: "FragDeData_de_defer")
              }
            }
            fragment FragData on DataType {
              d
            }
            fragment FragDeData on DataType {
              e
            }
          `);
          expect(isAsyncIterable(result)).to.equal(true);

          const results = [];
          await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
            results.push(value);
          });

          expect(results.length).to.equal(4);
          expect(results[0]).to.deep.equal({
            data: { a: 'a' },
          });
          expect(results[1]).to.deep.equal({
            data: {
              c: {},
            },
            label: 'Frag_c_defer',
            path: [],
          });

          expect(results[2]).to.deep.equal({
            data: { e: 'e' },
            label: 'FragDeData_de_defer',
            path: ['c'],
          });
          expect(results[3]).to.deep.equal({
            data: { d: 'd' },
            label: 'FragData_d_defer',
            path: ['c'],
          });
        });

        it('with two equals fragments', async () => {
          const result = await executeTestQuery(`
            query {
              a
              ...Frag @defer(if: true, label: "Frag_c_defer")
            }
            fragment Frag on TestType {
              c {
                ...FragData @defer(if: true, label: "FragData_d_defer")
                ...FragDeData @defer(if: true, label: "FragDeData_de_defer")
              }
            }
            fragment FragData on DataType {
              d
            }
            fragment FragDeData on DataType {
              d
            }
          `);
          expect(isAsyncIterable(result)).to.equal(true);

          const results = [];
          await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
            results.push(value);
          });

          expect(results.length).to.equal(4);
          expect(results[0]).to.deep.equal({
            data: { a: 'a' },
          });
          expect(results[1]).to.deep.equal({
            data: {
              c: {},
            },
            label: 'Frag_c_defer',
            path: [],
          });
          expect(results[2]).to.deep.equal({
            data: { d: 'd' },
            label: 'FragData_d_defer',
            path: ['c'],
          });
          expect(results[3]).to.deep.equal({
            data: { d: 'd' },
            label: 'FragDeData_de_defer',
            path: ['c'],
          });
        });

        it('mixed if true & if false', async () => {
          const result = await executeTestQuery(`
            query {
              a
              ...Frag @defer(if: true, label: "Frag_c_defer")
            }
            fragment Frag on TestType {
              c {
                ...FragData @defer(if: false, label: "FragData_d_defer")
              }
            }
            fragment FragData on DataType {
              d
            }
          `);
          expect(isAsyncIterable(result)).to.equal(true);

          const results = [];
          await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
            results.push(value);
          });

          expect(results.length).to.equal(2);
          expect(results[0]).to.deep.equal({
            data: { a: 'a' },
          });
          expect(results[1]).to.deep.equal({
            data: {
              c: { d: 'd' },
            },
            label: 'Frag_c_defer',
            path: [],
          });
        });

        it('mixed if false & if true', async () => {
          const result = await executeTestQuery(`
            query {
              a
              ...Frag @defer(if: false, label: "Frag_c_defer")
            }
            fragment Frag on TestType {
              c {
                ...FragData @defer(if: true, label: "FragData_d_defer")
              }
            }
            fragment FragData on DataType {
              d
            }
          `);
          expect(isAsyncIterable(result)).to.equal(true);

          const results = [];
          await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
            results.push(value);
          });

          expect(results.length).to.equal(2);
          expect(results[0]).to.deep.equal({
            data: {
              a: 'a',
              c: {},
            },
          });
          expect(results[1]).to.deep.equal({
            data: { d: 'd' },
            label: 'FragData_d_defer',
            path: ['c'],
          });
        });

        it('if true', async () => {
          const result = await executeTestQuery(`
            query {
              a
              ...Frag @defer(if: true, label: "Frag_c_defer")
            }
            fragment Frag on TestType {
              c {
                ...FragData @defer(if: true, label: "FragData_d_defer")
              }
            }
            fragment FragData on DataType {
              d
            }
          `);
          expect(isAsyncIterable(result)).to.equal(true);

          const results = [];
          await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
            results.push(value);
          });

          expect(results.length).to.equal(3);
          expect(results[0]).to.deep.equal({
            data: { a: 'a' },
          });
          expect(results[1]).to.deep.equal({
            data: {
              c: {},
            },
            label: 'Frag_c_defer',
            path: [],
          });
          expect(results[2]).to.deep.equal({
            data: { d: 'd' },
            label: 'FragData_d_defer',
            path: ['c'],
          });
        });
      });
    });
  });
  describe('works on inline fragment', () => {
    it('if false omits inline fragment', () => {
      const result = executeTestQuery(`
        query {
          a
          ... on TestType @include(if: false) {
            b
          }
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a' },
      });
    });

    it('if true includes inline fragment', () => {
      const result = executeTestQuery(`
        query {
          a
          ... on TestType @include(if: true) {
            b
          }
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a', b: 'b' },
      });
    });
    it('unless false includes inline fragment', () => {
      const result = executeTestQuery(`
        query {
          a
          ... on TestType @skip(if: false) {
            b
          }
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a', b: 'b' },
      });
    });
    it('unless true includes inline fragment', () => {
      const result = executeTestQuery(`
        query {
          a
          ... on TestType @skip(if: true) {
            b
          }
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a' },
      });
    });

    describe('defer on inline fragment', () => {
      it('without if', async () => {
        const result = await executeTestQuery(`
        query {
          a
          ... on TestType @defer(label: "Frag_b_defer") {
            b
          } 
        }
      `);
        expect(isAsyncIterable(result)).to.equal(true);
        const results = [];
        await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
          results.push(value);
        });

        expect(results.length).to.equal(2);
        expect(results[0]).to.deep.equal({
          data: { a: 'a' },
        });
        expect(results[1]).to.deep.equal({
          data: { b: 'b' },
          label: 'Frag_b_defer',
          path: [],
        });
      });

      it('if true', async () => {
        const result = await executeTestQuery(`
        query {
          a
          ... on TestType @defer(label: "Frag_b_defer") {
            b
          } 
        }
      `);
        expect(isAsyncIterable(result)).to.equal(true);

        const results = [];
        await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
          results.push(value);
        });

        expect(results.length).to.equal(2);
        expect(results[0]).to.deep.equal({
          data: { a: 'a' },
        });
        expect(results[1]).to.deep.equal({
          data: { b: 'b' },
          label: 'Frag_b_defer',
          path: [],
        });
      });

      it('if true DataType', async () => {
        const result = await executeTestQuery(`
            query {
              a
              ... on TestType @defer(if: true, label: "Frag_c_defer") {
                c {
                ... on DataType @defer(if: true, label: "FragData_d_defer") {
                    d
                  }
                }
              }
            }
          `);
        expect(isAsyncIterable(result)).to.equal(true);

        const results = [];
        await forAwaitEach(((result: any): AsyncIterable<mixed>), value => {
          results.push(value);
        });

        expect(results.length).to.equal(3);
        expect(results[0]).to.deep.equal({
          data: { a: 'a' },
        });
        expect(results[1]).to.deep.equal({
          data: {
            c: {},
          },
          label: 'Frag_c_defer',
          path: [],
        });
        expect(results[2]).to.deep.equal({
          data: { d: 'd' },
          label: 'FragData_d_defer',
          path: ['c'],
        });
      });
    });
  });

  describe('works on anonymous inline fragment', () => {
    it('if false omits anonymous inline fragment', () => {
      const result = executeTestQuery(`
        query {
          a
          ... @include(if: false) {
            b
          }
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a' },
      });
    });

    it('if true includes anonymous inline fragment', () => {
      const result = executeTestQuery(`
        query {
          a
          ... @include(if: true) {
            b
          }
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a', b: 'b' },
      });
    });
    it('unless false includes anonymous inline fragment', () => {
      const result = executeTestQuery(`
        query Q {
          a
          ... @skip(if: false) {
            b
          }
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a', b: 'b' },
      });
    });
    it('unless true includes anonymous inline fragment', () => {
      const result = executeTestQuery(`
        query {
          a
          ... @skip(if: true) {
            b
          }
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a' },
      });
    });
  });

  describe('works with skip and include directives', () => {
    it('include and no skip', () => {
      const result = executeTestQuery(`
        {
          a
          b @include(if: true) @skip(if: false)
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a', b: 'b' },
      });
    });

    it('include and skip', () => {
      const result = executeTestQuery(`
        {
          a
          b @include(if: true) @skip(if: true)
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a' },
      });
    });

    it('no include or skip', () => {
      const result = executeTestQuery(`
        {
          a
          b @include(if: false) @skip(if: false)
        }
      `);

      expect(result).to.deep.equal({
        data: { a: 'a' },
      });
    });
  });
});
