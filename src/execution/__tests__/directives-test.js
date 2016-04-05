/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { execute } from '../execute';
import { describe, it } from 'mocha';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
} from '../../type';


const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'TestType',
    fields: {
      a: { type: GraphQLString },
      b: { type: GraphQLString },
    }
  }),
});

const data = {
  a() { return 'a'; },
  b() { return 'b'; }
};

async function executeTestQuery(doc) {
  return await execute(schema, parse(doc), data);
}

describe('Execute: handles directives', () => {
  describe('works without directives', () => {
    it('basic query works', async () => {
      expect(
        await executeTestQuery('{ a, b }')
      ).to.deep.equal({
        data: { a: 'a', b: 'b' }
      });
    });
  });

  describe('works on scalars', () => {
    it('if true includes scalar', async () => {
      return expect(
        await executeTestQuery('{ a, b @include(if: true) }')
      ).to.deep.equal({
        data: { a: 'a', b: 'b' }
      });
    });

    it('if false omits on scalar', async () => {
      return expect(
        await executeTestQuery('{ a, b @include(if: false) }')
      ).to.deep.equal({
        data: { a: 'a' }
      });
    });

    it('unless false includes scalar', async () => {
      return expect(
        await executeTestQuery('{ a, b @skip(if: false) }')
      ).to.deep.equal({
        data: { a: 'a', b: 'b' }
      });
    });

    it('unless true omits scalar', async () => {
      return expect(
        await executeTestQuery('{ a, b @skip(if: true) }')
      ).to.deep.equal({
        data: { a: 'a' }
      });
    });
  });

  describe('works on fragment spreads', () => {
    it('if false omits fragment spread', async () => {
      const q = `
        query Q {
          a
          ...Frag @include(if: false)
        }
        fragment Frag on TestType {
          b
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a' }
      });
    });

    it('if true includes fragment spread', async () => {
      const q = `
        query Q {
          a
          ...Frag @include(if: true)
        }
        fragment Frag on TestType {
          b
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a', b: 'b' }
      });
    });

    it('unless false includes fragment spread', async () => {
      const q = `
        query Q {
          a
          ...Frag @skip(if: false)
        }
        fragment Frag on TestType {
          b
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a', b: 'b' }
      });
    });

    it('unless true omits fragment spread', async () => {
      const q = `
        query Q {
          a
          ...Frag @skip(if: true)
        }
        fragment Frag on TestType {
          b
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a' }
      });
    });
  });

  describe('works on inline fragment', () => {
    it('if false omits inline fragment', async () => {
      const q = `
        query Q {
          a
          ... on TestType @include(if: false) {
            b
          }
        }
        fragment Frag on TestType {
          b
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a' }
      });
    });

    it('if true includes inline fragment', async () => {
      const q = `
        query Q {
          a
          ... on TestType @include(if: true) {
            b
          }
        }
        fragment Frag on TestType {
          b
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a', b: 'b' }
      });
    });
    it('unless false includes inline fragment', async () => {
      const q = `
        query Q {
          a
          ... on TestType @skip(if: false) {
            b
          }
        }
        fragment Frag on TestType {
          b
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a', b: 'b' }
      });
    });
    it('unless true includes inline fragment', async () => {
      const q = `
        query Q {
          a
          ... on TestType @skip(if: true) {
            b
          }
        }
        fragment Frag on TestType {
          b
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a' }
      });
    });
  });

  describe('works on anonymous inline fragment', () => {
    it('if false omits anonymous inline fragment', async () => {
      const q = `
        query Q {
          a
          ... @include(if: false) {
            b
          }
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a' }
      });
    });

    it('if true includes anonymous inline fragment', async () => {
      const q = `
        query Q {
          a
          ... @include(if: true) {
            b
          }
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a', b: 'b' }
      });
    });
    it('unless false includes anonymous inline fragment', async () => {
      const q = `
        query Q {
          a
          ... @skip(if: false) {
            b
          }
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a', b: 'b' }
      });
    });
    it('unless true includes anonymous inline fragment', async () => {
      const q = `
        query Q {
          a
          ... @skip(if: true) {
            b
          }
        }
      `;
      return expect(await executeTestQuery(q)).to.deep.equal({
        data: { a: 'a' }
      });
    });
  });

  describe('works with skip and include directives', () => {
    it('include and no skip', async () => {
      return expect(
        await executeTestQuery('{ a, b @include(if: true) @skip(if: false) }')
      ).to.deep.equal({
        data: { a: 'a', b: 'b' }
      });
    });

    it('include and skip', async () => {
      return expect(
        await executeTestQuery('{ a, b @include(if: true) @skip(if: true) }')
      ).to.deep.equal({
        data: { a: 'a' }
      });
    });

    it('no include or skip', async () => {
      return expect(
        await executeTestQuery('{ a, b @include(if: false) @skip(if: false) }')
      ).to.deep.equal({
        data: { a: 'a' }
      });
    });
  });
});
