import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import { embedErrors } from '../embedErrors.js';

describe('embedErrors', () => {
  it('returns empty array when errors is undefined', () => {
    const embedded = embedErrors({}, undefined);
    expect(embedded).to.deep.equal([]);
  });

  it('returns empty array when errors is an empty list', () => {
    const embedded = embedErrors({}, []);
    expect(embedded).to.deep.equal([]);
  });

  it('can embed an error', () => {
    const error = new GraphQLError('error message', { path: ['a', 'b', 'c'] });
    const data = { a: { b: { c: null } } };
    const embedded = embedErrors(data, [error]);
    expectJSON(data).toDeepEqual({
      a: { b: { c: new AggregateError([error]) } },
    });
    expect(embedded).to.deep.equal([]);
  });

  it('can embed a bubbled error', () => {
    const error = new GraphQLError('error message', {
      path: ['a', 'b', 'c', 'd'],
    });
    const data = { a: { b: { c: null } } };
    const embedded = embedErrors(data, [error]);
    expectJSON(data).toDeepEqual({
      a: { b: { c: new AggregateError([error]) } },
    });
    expect(embedded).to.deep.equal([]);
  });

  it('can embed multiple errors', () => {
    const error1 = new GraphQLError('error message 1', {
      path: ['a', 'b', 'c'],
    });
    const error2 = new GraphQLError('error message 2', {
      path: ['a', 'b', 'c'],
    });
    const data = { a: { b: { c: null } } };
    const embedded = embedErrors(data, [error1, error2]);
    expectJSON(data).toDeepEqual({
      a: { b: { c: new AggregateError([error1, error2]) } },
    });
    expect(embedded).to.deep.equal([]);
  });

  it('returns errors with no path', () => {
    const error = new GraphQLError('error message');
    const data = { a: { b: { c: null } } };
    const embedded = embedErrors(data, [error]);
    expectJSON(data).toDeepEqual(data);
    expectJSON(embedded).toDeepEqual([error]);
  });

  it('returns errors with empty path', () => {
    const error = new GraphQLError('error message', { path: [] });
    const data = { a: { b: { c: null } } };
    const embedded = embedErrors(data, [error]);
    expectJSON(data).toDeepEqual(data);
    expectJSON(embedded).toDeepEqual([error]);
  });

  it('returns errors with invalid numeric path', () => {
    const error = new GraphQLError('error message', {
      path: ['a', 0],
    });
    const data = { a: { b: { c: null } } };
    const embedded = embedErrors(data, [error]);
    expectJSON(data).toDeepEqual(data);
    expectJSON(embedded).toDeepEqual([error]);
  });

  it('returns errors with invalid non-terminating numeric path segment', () => {
    const error = new GraphQLError('error message', {
      path: ['a', 0, 'c'],
    });
    const data = { a: { b: { c: null } } };
    const embedded = embedErrors(data, [error]);
    expectJSON(data).toDeepEqual(data);
    expectJSON(embedded).toDeepEqual([error]);
  });

  it('returns errors with invalid string path', () => {
    const error = new GraphQLError('error message', {
      path: ['a', 'b'],
    });
    const data = { a: [{ b: { c: null } }] };
    const embedded = embedErrors(data, [error]);
    expectJSON(data).toDeepEqual(data);
    expectJSON(embedded).toDeepEqual([error]);
  });

  it('returns errors with invalid non-terminating string path segment', () => {
    const error = new GraphQLError('error message', {
      path: ['a', 'b', 'c'],
    });
    const data = { a: [{ b: { c: null } }] };
    const embedded = embedErrors(data, [error]);
    expectJSON(data).toDeepEqual(data);
    expectJSON(embedded).toDeepEqual([error]);
  });

  it('returns errors with invalid path without null', () => {
    const error = new GraphQLError('error message', {
      path: ['a', 'b', 'c', 'd'],
    });
    const data = { a: { b: { c: 1 } } };
    const embedded = embedErrors(data, [error]);
    expectJSON(data).toDeepEqual(data);
    expectJSON(embedded).toDeepEqual([error]);
  });

  it('returns errors with invalid path without null with invalid non-terminating path segment', () => {
    const error = new GraphQLError('error message', {
      path: ['a', 'b', 'c', 'd', 'e'],
    });
    const data = { a: { b: { c: 1 } } };
    const embedded = embedErrors(data, [error]);
    expectJSON(data).toDeepEqual(data);
    expectJSON(embedded).toDeepEqual([error]);
  });
});
