import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';

import { parse } from '../../language/parser';
import { print } from '../../language/printer';

import { mergeAST } from '../mergeAST';

describe('mergeAST', () => {
  it('merges two simple queries', () => {
    const docA = parse('{ a, b }');
    const docB = parse('{ c, d }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        a
        b
        c
        d
      }
    `);
  });

  it('deduplicates identical fields', () => {
    const docA = parse('{ a, b }');
    const docB = parse('{ b, c }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        a
        b
        c
      }
    `);
  });

  it('recursively merges nested selection sets', () => {
    const docA = parse('{ user { name } }');
    const docB = parse('{ user { email } }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        user {
          name
          email
        }
      }
    `);
  });

  it('deeply merges nested selection sets', () => {
    const docA = parse('{ user { profile { name } } }');
    const docB = parse('{ user { profile { avatar } } }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        user {
          profile {
            name
            avatar
          }
        }
      }
    `);
  });

  it('does not merge fields with different arguments', () => {
    const docA = parse('{ user(id: 1) { name } }');
    const docB = parse('{ user(id: 2) { name } }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        user(id: 1) {
          name
        }
        user(id: 2) {
          name
        }
      }
    `);
  });

  it('merges fields with same arguments', () => {
    const docA = parse('{ user(id: 1) { name } }');
    const docB = parse('{ user(id: 1) { email } }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        user(id: 1) {
          name
          email
        }
      }
    `);
  });

  it('handles aliased fields', () => {
    const docA = parse('{ myUser: user { name } }');
    const docB = parse('{ myUser: user { email } }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        myUser: user {
          name
          email
        }
      }
    `);
  });

  it('does not merge different aliases for the same field', () => {
    const docA = parse('{ a: user { name } }');
    const docB = parse('{ b: user { name } }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        a: user {
          name
        }
        b: user {
          name
        }
      }
    `);
  });

  it('merges named operations of the same type', () => {
    const docA = parse('query GetUser { user { name } }');
    const docB = parse('query GetUser { user { email } }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      query GetUser {
        user {
          name
          email
        }
      }
    `);
  });

  it('keeps separate operations with different names', () => {
    const docA = parse('query GetUser { user { name } }');
    const docB = parse('query GetPosts { posts { title } }');

    const result = print(mergeAST([docA, docB]));
    expect(result).to.equal(dedent`
      query GetUser {
        user {
          name
        }
      }

      query GetPosts {
        posts {
          title
        }
      }
    `);
  });

  it('keeps separate operations with different types', () => {
    const docA = parse('query { user { name } }');
    const docB = parse('mutation { createUser { id } }');

    const result = print(mergeAST([docA, docB]));
    expect(result).to.equal(dedent`
      {
        user {
          name
        }
      }

      mutation {
        createUser {
          id
        }
      }
    `);
  });

  it('merges variable definitions and deduplicates', () => {
    const docA = parse('query GetUser($id: ID!) { user(id: $id) { name } }');
    const docB = parse(
      'query GetUser($id: ID!, $includeEmail: Boolean!) { user(id: $id) { email @include(if: $includeEmail) } }',
    );

    const result = print(mergeAST([docA, docB]));
    expect(result).to.equal(dedent`
      query GetUser($id: ID!, $includeEmail: Boolean!) {
        user(id: $id) {
          name
          email @include(if: $includeEmail)
        }
      }
    `);
  });

  it('deduplicates fragment definitions', () => {
    const docA = parse(`
      { ...UserFields }
      fragment UserFields on User { name }
    `);
    const docB = parse(`
      { ...UserFields }
      fragment UserFields on User { name }
    `);

    const result = print(mergeAST([docA, docB]));
    expect(result).to.equal(dedent`
      {
        ...UserFields
      }

      fragment UserFields on User {
        name
      }
    `);
  });

  it('merges inline fragments with the same type condition', () => {
    const docA = parse('{ ... on User { name } }');
    const docB = parse('{ ... on User { email } }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        ... on User {
          name
          email
        }
      }
    `);
  });

  it('keeps separate inline fragments with different type conditions', () => {
    const docA = parse('{ ... on User { name } }');
    const docB = parse('{ ... on Post { title } }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        ... on User {
          name
        }
        ... on Post {
          title
        }
      }
    `);
  });

  it('handles merging more than two documents', () => {
    const docA = parse('{ a }');
    const docB = parse('{ b }');
    const docC = parse('{ c }');

    expect(print(mergeAST([docA, docB, docC]))).to.equal(dedent`
      {
        a
        b
        c
      }
    `);
  });

  it('returns empty document for empty array', () => {
    const result = mergeAST([]);
    expect(result.definitions).to.deep.equal([]);
  });

  it('returns equivalent document for single document', () => {
    const doc = parse('{ a, b }');
    expect(print(mergeAST([doc]))).to.equal(print(doc));
  });

  it('handles the use case from the issue: adding required fields', () => {
    // Client queries avgRating, resolver needs ratings { stars } to compute it
    const clientQuery = parse(`
      {
        home {
          avgRating
          address
        }
      }
    `);

    const requiredFields = parse(`
      {
        home {
          ratings {
            stars
          }
        }
      }
    `);

    expect(print(mergeAST([clientQuery, requiredFields]))).to.equal(dedent`
      {
        home {
          avgRating
          address
          ratings {
            stars
          }
        }
      }
    `);
  });

  it('deduplicates fragment spreads', () => {
    const docA = parse('{ ...Frag, a }');
    const docB = parse('{ ...Frag, b }');

    expect(print(mergeAST([docA, docB]))).to.equal(dedent`
      {
        ...Frag
        a
        b
      }
    `);
  });
});
