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
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLString
} from '../';

import { describe, it } from 'mocha';
import { expect } from 'chai';

const InterfaceType = new GraphQLInterfaceType({
  name: 'Interface',
  fields: { fieldName: { type: GraphQLString } },
  resolveType() {
    return ImplementingType;
  }
});

const ImplementingType = new GraphQLObjectType({
  name: 'Object',
  interfaces: [ InterfaceType ],
  fields: { fieldName: { type: GraphQLString, resolve: () => '' }}
});

const Schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      getObject: {
        type: InterfaceType,
        resolve() {
          return {};
        }
      }
    }
  })
});

describe('Type System: Schema', () => {
  describe('Getting possible types', () => {
    it('throws human-reable error if schema.types is not defined', () => {
      const checkPossible = () => {
        return Schema.isPossibleType(InterfaceType, ImplementingType);
      };
      expect(checkPossible).to.throw(
        'Could not find possible implementing types for Interface in schema. ' +
        'Check that schema.types is defined and is an array ofall possible ' +
        'types in the schema.'
      );
    });
  });
});
