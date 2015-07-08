/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import {
  GraphQLSchema,
  GraphQLObjectType,
} from '../';

import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('Type System: Schema', () => {
  it('does not allow more than one type of the same name', () => {
    var A = new GraphQLObjectType({
      name: 'SameName',
      fields: {}
    });

    var B = new GraphQLObjectType({
      name: 'SameName',
      fields: {}
    });

    var SomeQuery = new GraphQLObjectType({
      name: 'SomeQuery',
      fields: {
        a: { type: A },
        b: { type: B }
      }
    });

    expect(
      () => new GraphQLSchema({ query: SomeQuery })
    ).to.throw('Schema cannot contain more than one type named SameName.');
  });
});
