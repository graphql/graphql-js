/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  GraphQLSchema,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInputObjectType,
  GraphQLDirective,
} from '../';

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { GraphQLList } from '../wrappers';

const InterfaceType = new GraphQLInterfaceType({
  name: 'Interface',
  fields: { fieldName: { type: GraphQLString } },
});

const ImplementingType = new GraphQLObjectType({
  name: 'Object',
  interfaces: [InterfaceType],
  fields: { fieldName: { type: GraphQLString, resolve: () => '' } },
});

const DirectiveInputType = new GraphQLInputObjectType({
  name: 'DirInput',
  fields: {
    field: {
      type: GraphQLString,
    },
  },
});

const WrappedDirectiveInputType = new GraphQLInputObjectType({
  name: 'WrappedDirInput',
  fields: {
    field: {
      type: GraphQLString,
    },
  },
});

const Directive = new GraphQLDirective({
  name: 'dir',
  locations: ['OBJECT'],
  args: {
    arg: {
      type: DirectiveInputType,
    },
    argList: {
      type: new GraphQLList(WrappedDirectiveInputType),
    },
  },
});

const Schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      getObject: {
        type: InterfaceType,
        resolve() {
          return {};
        },
      },
    },
  }),
  directives: [Directive],
});

describe('Type System: Schema', () => {
  describe('Getting possible types', () => {
    it('throws human-reable error if schema.types is not defined', () => {
      const checkPossible = () => {
        return Schema.isPossibleType(InterfaceType, ImplementingType);
      };
      expect(checkPossible).to.throw(
        'Could not find possible implementing types for Interface in schema. ' +
          'Check that schema.types is defined and is an array of all possible ' +
          'types in the schema.',
      );
    });
  });

  describe('Type Map', () => {
    it('includes input types only used in directives', () => {
      expect(Schema.getTypeMap()).to.include.key('DirInput');
      expect(Schema.getTypeMap()).to.include.key('WrappedDirInput');
    });
  });
});
