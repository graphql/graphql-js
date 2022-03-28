import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import { GraphQLObjectType } from '../../type/definition';
import { GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { executeSync } from '../execute';

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'TestType',
    fields: {
      a: { type: GraphQLString },
      b: { type: GraphQLString },
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
};

function executeTestQuery(query: string) {
  const document = parse(query);
  return executeSync({ schema, document, rootValue });
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
