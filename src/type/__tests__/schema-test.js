/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import {
  GraphQLSchema,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInputObjectType,
  GraphQLDirective,
  GraphQLList,
} from '../';

import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('Type System: Schema', () => {
  describe('Type Map', () => {
    it('includes input types only used in directives', () => {
      const directive = new GraphQLDirective({
        name: 'dir',
        locations: ['OBJECT'],
        args: {
          arg: {
            type: new GraphQLInputObjectType({ name: 'Foo', fields: {} }),
          },
          argList: {
            type: new GraphQLList(
              new GraphQLInputObjectType({ name: 'Bar', fields: {} }),
            ),
          },
        },
      });
      const schema = new GraphQLSchema({ directives: [directive] });

      expect(schema.getTypeMap()).to.include.keys('Foo', 'Bar');
    });
  });

  describe('Validity', () => {
    describe('when not assumed valid', () => {
      it('configures the schema to still needing validation', () => {
        expect(
          new GraphQLSchema({
            assumeValid: false,
          }).__validationErrors,
        ).to.equal(undefined);
      });

      it('configures the schema for allowed legacy names', () => {
        expect(
          new GraphQLSchema({
            allowedLegacyNames: ['__badName'],
          }).__allowedLegacyNames,
        ).to.deep.equal(['__badName']);
      });

      it('checks the configuration for mistakes', () => {
        // $DisableFlowOnNegativeTest
        expect(() => new GraphQLSchema(() => null)).to.throw();
        // $DisableFlowOnNegativeTest
        expect(() => new GraphQLSchema({ types: {} })).to.throw();
        // $DisableFlowOnNegativeTest
        expect(() => new GraphQLSchema({ directives: {} })).to.throw();
        // $DisableFlowOnNegativeTest
        expect(() => new GraphQLSchema({ allowedLegacyNames: {} })).to.throw();
      });
    });

    describe('A Schema must contain uniquely named types', () => {
      it('rejects a Schema which redefines a built-in type', () => {
        const FakeString = new GraphQLScalarType({
          name: 'String',
          serialize: () => null,
        });

        const QueryType = new GraphQLObjectType({
          name: 'Query',
          fields: {
            normal: { type: GraphQLString },
            fake: { type: FakeString },
          },
        });

        expect(() => new GraphQLSchema({ query: QueryType })).to.throw(
          'Schema must contain unique named types but contains multiple types named "String".',
        );
      });

      it('rejects a Schema which defines an object type twice', () => {
        const types = [
          new GraphQLObjectType({ name: 'SameName', fields: {} }),
          new GraphQLObjectType({ name: 'SameName', fields: {} }),
        ];

        expect(() => new GraphQLSchema({ types })).to.throw(
          'Schema must contain unique named types but contains multiple types named "SameName".',
        );
      });

      it('rejects a Schema which defines fields with conflicting types', () => {
        const fields = {};
        const QueryType = new GraphQLObjectType({
          name: 'Query',
          fields: {
            a: { type: new GraphQLObjectType({ name: 'SameName', fields }) },
            b: { type: new GraphQLObjectType({ name: 'SameName', fields }) },
          },
        });

        expect(() => new GraphQLSchema({ query: QueryType })).to.throw(
          'Schema must contain unique named types but contains multiple types named "SameName".',
        );
      });
    });

    describe('when assumed valid', () => {
      it('configures the schema to have no errors', () => {
        expect(
          new GraphQLSchema({
            assumeValid: true,
          }).__validationErrors,
        ).to.deep.equal([]);
      });

      it('still configures the schema for allowed legacy names', () => {
        expect(
          new GraphQLSchema({
            assumeValid: true,
            allowedLegacyNames: ['__badName'],
          }).__allowedLegacyNames,
        ).to.deep.equal(['__badName']);
      });

      it('does not check the configuration for mistakes', () => {
        const config = () => null;
        config.assumeValid = true;
        // $DisableFlowOnNegativeTest
        expect(() => new GraphQLSchema(config)).to.not.throw();

        expect(
          () =>
            // $DisableFlowOnNegativeTest
            new GraphQLSchema({
              assumeValid: true,
              types: {},
              directives: { reduce: () => [] },
              allowedLegacyNames: {},
            }),
        ).to.not.throw();
      });
    });
  });
});
