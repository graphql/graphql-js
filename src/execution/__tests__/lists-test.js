/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// 80+ char lines are useful in describe/it, so ignore in this file.
/* eslint-disable max-len */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { formatError } from '../../error';
import { execute } from '../execute';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull
} from '../../type';

// resolved() is shorthand for Promise.resolve()
const resolved = Promise.resolve.bind(Promise);

// rejected() is shorthand for Promise.reject()
const rejected = Promise.reject.bind(Promise);

/**
 * This function creates a test case passed to "it", there's a time delay
 * between when the test is created and when the test is run, so if testData
 * contains a rejection, testData should be a function that returns that
 * rejection so as not to trigger the "unhandled rejection" error watcher.
 */
function check(testType, testData, expected) {
  return async () => {
    const data = { test: testData };

    const dataType = new GraphQLObjectType({
      name: 'DataType',
      fields: () => ({
        test: { type: testType },
        nest: { type: dataType, resolve: () => data },
      })
    });

    const schema = new GraphQLSchema({ query: dataType });

    const ast = parse('{ nest { test } }');

    const response = await execute(schema, ast, data);

    // Formatting errors for ease of test writing.
    let result;
    if (response.errors) {
      result = {
        data: response.data,
        errors: response.errors.map(formatError)
      };
    } else {
      result = response;
    }
    expect(result).to.deep.equal(expected);
  };
}

describe('Execute: Handles list nullability', () => {

  describe('[T]', () => {
    const type = new GraphQLList(GraphQLInt);

    describe('Array<T>', () => {

      it('Contains values', check(type,
        [ 1, 2 ],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [ 1, null, 2 ],
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));

      it('Returns null', check(type,
        null,
        { data: { nest: { test: null } } }
      ));

    });

    describe('Promise<Array<T>>', () => {

      it('Contains values', check(type,
        resolved([ 1, 2 ]),
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        resolved([ 1, null, 2 ]),
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));


      it('Returns null', check(type,
        resolved(null),
        { data: { nest: { test: null } } }
      ));

      it('Rejected', check(type,
        () => rejected(new Error('bad')),
        { data: { nest: { test: null } },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Array<Promise<T>>', () => {

      it('Contains values', check(type,
        [ resolved(1), resolved(2) ],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [ resolved(1), resolved(null), resolved(2) ],
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));

      it('Contains reject', check(type,
        () => [ resolved(1), rejected(new Error('bad')), resolved(2) ],
        { data: { nest: { test: [ 1, null, 2 ] } },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

  });

  describe('[T]!', () => {
    const type = new GraphQLNonNull(new GraphQLList(GraphQLInt));

    describe('Array<T>', () => {

      it('Contains values', check(type,
        [ 1, 2 ],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [ 1, null, 2 ],
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));

      it('Returns null', check(type,
        null,
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable field DataType.test.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Promise<Array<T>>', () => {

      it('Contains values', check(type,
        resolved([ 1, 2 ]),
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        resolved([ 1, null, 2 ]),
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));

      it('Returns null', check(type,
        resolved(null),
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable field DataType.test.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Rejected', check(type,
        () => rejected(new Error('bad')),
        { data: { nest: null },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Array<Promise<T>>', () => {

      it('Contains values', check(type,
        [ resolved(1), resolved(2) ],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [ resolved(1), resolved(null), resolved(2) ],
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));

      it('Contains reject', check(type,
        () => [ resolved(1), rejected(new Error('bad')), resolved(2) ],
        { data: { nest: { test: [ 1, null, 2 ] } },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

  });

  describe('[T!]', () => {
    const type = new GraphQLList(new GraphQLNonNull(GraphQLInt));

    describe('Array<T>', () => {

      it('Contains values', check(type,
        [ 1, 2 ],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [ 1, null, 2 ],
        { data: { nest: { test: null } },
          errors: [
            { message: 'Cannot return null for non-nullable field DataType.test.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Returns null', check(type,
        null,
        { data: { nest: { test: null } } }
      ));

    });

    describe('Promise<Array<T>>', () => {

      it('Contains values', check(type,
        resolved([ 1, 2 ]),
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        resolved([ 1, null, 2 ]),
        { data: { nest: { test: null } },
          errors: [
            { message: 'Cannot return null for non-nullable field DataType.test.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Returns null', check(type,
        resolved(null),
        { data: { nest: { test: null } } }
      ));

      it('Rejected', check(type,
        () => rejected(new Error('bad')),
        { data: { nest: { test: null } },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Array<Promise<T>>', () => {

      it('Contains values', check(type,
        [ resolved(1), resolved(2) ],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [ resolved(1), resolved(null), resolved(2) ],
        { data: { nest: { test: null } },
          errors: [
            { message: 'Cannot return null for non-nullable field DataType.test.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Contains reject', check(type,
        () => [ resolved(1), rejected(new Error('bad')), resolved(2) ],
        { data: { nest: { test: null } },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

  });

  describe('[T!]!', () => {
    const type =
      new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLInt)));

    describe('Array<T>', () => {

      it('Contains values', check(type,
        [ 1, 2 ],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));


      it('Contains null', check(type,
        [ 1, null, 2 ],
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable field DataType.test.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Returns null', check(type,
        null,
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable field DataType.test.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Promise<Array<T>>', () => {

      it('Contains values', check(type,
        resolved([ 1, 2 ]),
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        resolved([ 1, null, 2 ]),
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable field DataType.test.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Returns null', check(type,
        resolved(null),
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable field DataType.test.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Rejected', check(type,
        () => rejected(new Error('bad')),
        { data: { nest: null },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Array<Promise<T>>', () => {

      it('Contains values', check(type,
        [ resolved(1), resolved(2) ],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [ resolved(1), resolved(null), resolved(2) ],
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable field DataType.test.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Contains reject', check(type,
        () => [ resolved(1), rejected(new Error('bad')), resolved(2) ],
        { data: { nest: null },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

  });

});
