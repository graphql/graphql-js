/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// 80+ char lines are useful in describe/it, so ignore in this file.
/*eslint-disable max-len */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { execute } from '../executor';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull
} from '../../type';

var resolve = Promise.resolve.bind(Promise);
var reject = Promise.reject.bind(Promise);

function check(testType, testData, expected) {
  return function () {
    var data = { test: testData };

    var dataType = new GraphQLObjectType({
      name: 'DataType',
      fields: () => ({
        test: { type: testType },
        nest: { type: dataType, resolve: () => data },
      })
    });

    var schema = new GraphQLSchema({ query: dataType });

    var ast = parse('{ nest { test } }');

    return expect(execute(schema, data, ast)).to.become(expected);
  };
}

describe('Execute: Handles list nullability', () => {

  describe('[T]', () => {
    var type = new GraphQLList(GraphQLInt);

    describe('Array<T>', () => {

      it('Contains values', check(type,
        [1, 2],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [1, null, 2],
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));

      it('Returns null', check(type,
        null,
        { data: { nest: { test: null } } }
      ));

    });

    describe('Promise<Array<T>>', () => {

      it('Contains values', check(type,
        resolve([1, 2]),
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        resolve([1, null, 2]),
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));


      it('Returns null', check(type,
        resolve(null),
        { data: { nest: { test: null } } }
      ));

      it('Rejected', check(type,
        reject(new Error('bad')),
        { data: { nest: { test: null } },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Array<Promise<T>>', () => {

      it('Contains values', check(type,
        [resolve(1), resolve(2)],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [resolve(1), resolve(null), resolve(2)],
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));

      it('Contains reject', check(type,
        [resolve(1), reject(new Error('bad')), resolve(2)],
        { data: { nest: { test: [ 1, null, 2 ] } },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

  });

  describe('[T]!', () => {
    var type = new GraphQLNonNull(new GraphQLList(GraphQLInt));

    describe('Array<T>', () => {

      it('Contains values', check(type,
        [1, 2],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [1, null, 2],
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));

      it('Returns null', check(type,
        null,
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable type.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Promise<Array<T>>', () => {

      it('Contains values', check(type,
        resolve([1, 2]),
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        resolve([1, null, 2]),
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));

      it('Returns null', check(type,
        resolve(null),
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable type.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Rejected', check(type,
        reject(new Error('bad')),
        { data: { nest: null },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Array<Promise<T>>', () => {

      it('Contains values', check(type,
        [resolve(1), resolve(2)],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [resolve(1), resolve(null), resolve(2)],
        { data: { nest: { test: [ 1, null, 2 ] } } }
      ));

      it('Contains reject', check(type,
        [resolve(1), reject(new Error('bad')), resolve(2)],
        { data: { nest: { test: [ 1, null, 2 ] } },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

  });

  describe('[T!]', () => {
    var type = new GraphQLList(new GraphQLNonNull(GraphQLInt));

    describe('Array<T>', () => {

      it('Contains values', check(type,
        [1, 2],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [1, null, 2],
        { data: { nest: { test: null } },
          errors: [
            { message: 'Cannot return null for non-nullable type.',
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
        resolve([1, 2]),
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        resolve([1, null, 2]),
        { data: { nest: { test: null } },
          errors: [
            { message: 'Cannot return null for non-nullable type.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Returns null', check(type,
        resolve(null),
        { data: { nest: { test: null } } }
      ));

      it('Rejected', check(type,
        reject(new Error('bad')),
        { data: { nest: { test: null } },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Array<Promise<T>>', () => {

      it('Contains values', check(type,
        [resolve(1), resolve(2)],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [resolve(1), resolve(null), resolve(2)],
        { data: { nest: { test: null } },
          errors: [
            { message: 'Cannot return null for non-nullable type.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Contains reject', check(type,
        [resolve(1), reject(new Error('bad')), resolve(2)],
        { data: { nest: { test: null } },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

  });

  describe('[T!]!', () => {
    var type =
      new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLInt)));

    describe('Array<T>', () => {

      it('Contains values', check(type,
        [1, 2],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));


      it('Contains null', check(type,
        [1, null, 2],
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable type.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Returns null', check(type,
        null,
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable type.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Promise<Array<T>>', () => {

      it('Contains values', check(type,
        resolve([1, 2]),
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        resolve([1, null, 2]),
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable type.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Returns null', check(type,
        resolve(null),
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable type.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Rejected', check(type,
        reject(new Error('bad')),
        { data: { nest: null },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

    describe('Array<Promise<T>>', () => {

      it('Contains values', check(type,
        [resolve(1), resolve(2)],
        { data: { nest: { test: [ 1, 2 ] } } }
      ));

      it('Contains null', check(type,
        [resolve(1), resolve(null), resolve(2)],
        { data: { nest: null },
          errors: [
            { message: 'Cannot return null for non-nullable type.',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

      it('Contains reject', check(type,
        [resolve(1), reject(new Error('bad')), resolve(2)],
        { data: { nest: null },
          errors: [
            { message: 'bad',
              locations: [ { line: 1, column: 10 } ] }
          ] }
      ));

    });

  });

});
