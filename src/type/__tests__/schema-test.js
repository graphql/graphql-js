/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';

import dedent from '../../jsutils/dedent';
import { printSchema } from '../../utilities/schemaPrinter';
import {
  GraphQLSchema,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
  GraphQLBoolean,
  GraphQLInterfaceType,
  GraphQLInputObjectType,
  GraphQLDirective,
  GraphQLList,
} from '../';

describe('Type System: Schema', () => {
  it('Define sample schema', () => {
    const BlogImage = new GraphQLObjectType({
      name: 'Image',
      fields: {
        url: { type: GraphQLString },
        width: { type: GraphQLInt },
        height: { type: GraphQLInt },
      },
    });

    const BlogAuthor = new GraphQLObjectType({
      name: 'Author',
      fields: () => ({
        id: { type: GraphQLString },
        name: { type: GraphQLString },
        pic: {
          args: { width: { type: GraphQLInt }, height: { type: GraphQLInt } },
          type: BlogImage,
        },
        recentArticle: { type: BlogArticle },
      }),
    });

    const BlogArticle = new GraphQLObjectType({
      name: 'Article',
      fields: {
        id: { type: GraphQLString },
        isPublished: { type: GraphQLBoolean },
        author: { type: BlogAuthor },
        title: { type: GraphQLString },
        body: { type: GraphQLString },
      },
    });

    const BlogQuery = new GraphQLObjectType({
      name: 'Query',
      fields: {
        article: {
          args: { id: { type: GraphQLString } },
          type: BlogArticle,
        },
        feed: {
          type: GraphQLList(BlogArticle),
        },
      },
    });

    const BlogMutation = new GraphQLObjectType({
      name: 'Mutation',
      fields: {
        writeArticle: {
          type: BlogArticle,
        },
      },
    });

    const BlogSubscription = new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        articleSubscribe: {
          args: { id: { type: GraphQLString } },
          type: BlogArticle,
        },
      },
    });

    const schema = new GraphQLSchema({
      query: BlogQuery,
      mutation: BlogMutation,
      subscription: BlogSubscription,
    });

    expect(printSchema(schema)).to.equal(dedent`
      type Article {
        id: String
        isPublished: Boolean
        author: Author
        title: String
        body: String
      }

      type Author {
        id: String
        name: String
        pic(width: Int, height: Int): Image
        recentArticle: Article
      }

      type Image {
        url: String
        width: Int
        height: Int
      }

      type Mutation {
        writeArticle: Article
      }

      type Query {
        article(id: String): Article
        feed: [Article]
      }

      type Subscription {
        articleSubscribe(id: String): Article
      }
    `);
  });

  describe('Root types', () => {
    const testType = new GraphQLObjectType({ name: 'TestType', fields: {} });

    it('defines a query root', () => {
      const schema = new GraphQLSchema({ query: testType });
      expect(schema.getQueryType()).to.equal(testType);
      expect(schema.getTypeMap()).to.include.key('TestType');
    });

    it('defines a mutation root', () => {
      const schema = new GraphQLSchema({ mutation: testType });
      expect(schema.getMutationType()).to.equal(testType);
      expect(schema.getTypeMap()).to.include.key('TestType');
    });

    it('defines a subscription root', () => {
      const schema = new GraphQLSchema({ subscription: testType });
      expect(schema.getSubscriptionType()).to.equal(testType);
      expect(schema.getTypeMap()).to.include.key('TestType');
    });
  });

  describe('Type Map', () => {
    it('includes interface possible types in the type map', () => {
      const SomeInterface = new GraphQLInterfaceType({
        name: 'SomeInterface',
        fields: {},
      });

      const SomeSubtype = new GraphQLObjectType({
        name: 'SomeSubtype',
        fields: {},
        interfaces: [SomeInterface],
      });

      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            iface: { type: SomeInterface },
          },
        }),
        types: [SomeSubtype],
      });

      expect(schema.getType('SomeInterface')).to.equal(SomeInterface);
      expect(schema.getType('SomeSubtype')).to.equal(SomeSubtype);
    });

    it("includes interfaces' thunk subtypes in the type map", () => {
      const SomeInterface = new GraphQLInterfaceType({
        name: 'SomeInterface',
        fields: {},
      });

      const SomeSubtype = new GraphQLObjectType({
        name: 'SomeSubtype',
        fields: {},
        interfaces: () => [SomeInterface],
      });

      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            iface: { type: SomeInterface },
          },
        }),
        types: [SomeSubtype],
      });

      expect(schema.getType('SomeInterface')).to.equal(SomeInterface);
      expect(schema.getType('SomeSubtype')).to.equal(SomeSubtype);
    });

    it('includes nested input objects in the map', () => {
      const NestedInputObject = new GraphQLInputObjectType({
        name: 'NestedInputObject',
        fields: {},
      });

      const SomeInputObject = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: { nested: { type: NestedInputObject } },
      });

      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            something: {
              type: GraphQLString,
              args: { input: { type: SomeInputObject } },
            },
          },
        }),
      });

      expect(schema.getType('SomeInputObject')).to.equal(SomeInputObject);
      expect(schema.getType('NestedInputObject')).to.equal(NestedInputObject);
    });

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

  it('can be Object.toStringified', () => {
    const schema = new GraphQLSchema({});

    expect(Object.prototype.toString.call(schema)).to.equal(
      '[object GraphQLSchema]',
    );
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
          'Schema must contain uniquely named types but contains multiple types named "String".',
        );
      });

      it('rejects a Schema which defines an object type twice', () => {
        const types = [
          new GraphQLObjectType({ name: 'SameName', fields: {} }),
          new GraphQLObjectType({ name: 'SameName', fields: {} }),
        ];

        expect(() => new GraphQLSchema({ types })).to.throw(
          'Schema must contain uniquely named types but contains multiple types named "SameName".',
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
          'Schema must contain uniquely named types but contains multiple types named "SameName".',
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
