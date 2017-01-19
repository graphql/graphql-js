/**
 *  Copyright (c) 2016, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { findDeprecatedUsages } from '../findDeprecatedUsages';
import { parse } from '../../language';
import {
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from '../../type';

describe('findDeprecatedUsages', () => {

  const enumType = new GraphQLEnumType({
    name: 'EnumType',
    values: {
      ONE: {},
      TWO: { deprecationReason: 'Some enum reason.' }
    }
  });

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        normalField: {
          args: {
            enumArg: { type: enumType },
          },
          type: GraphQLString,
        },
        deprecatedField: {
          type: GraphQLString,
          deprecationReason: 'Some field reason.',
        }
      }
    })
  });

  it('should report empty set for no deprecated usages', () => {
    const errors = findDeprecatedUsages(
      schema,
      parse('{ normalField(enumArg: ONE) }')
    );

    expect(errors.length).to.equal(0);
  });

  it('should report usage of deprecated fields', () => {
    const errors = findDeprecatedUsages(
      schema,
      parse('{ normalField, deprecatedField }')
    );

    const errorMessages = errors.map(err => err.message);

    expect(errorMessages).to.deep.equal([
      'The field Query.deprecatedField is deprecated. Some field reason.'
    ]);
  });

  it('should report usage of deprecated enums', () => {
    const errors = findDeprecatedUsages(
      schema,
      parse('{ normalField(enumArg: TWO) }')
    );

    const errorMessages = errors.map(err => err.message);

    expect(errorMessages).to.deep.equal([
      'The enum value EnumType.TWO is deprecated. Some enum reason.'
    ]);
  });

});
