import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent.js';

import { DirectiveLocation } from '../../language/directiveLocation.js';

import { printSchema } from '../../utilities/printSchema.js';

import type { GraphQLCompositeType } from '../definition.js';
import {
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
} from '../definition.js';
import { GraphQLDirective } from '../directives.js';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from '../introspection.js';
import { GraphQLBoolean, GraphQLInt, GraphQLString } from '../scalars.js';
import { GraphQLSchema } from '../schema.js';
import { validateSchema } from '../validate.js';

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

    const BlogAuthor: GraphQLObjectType = new GraphQLObjectType({
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

    const BlogArticle: GraphQLObjectType = new GraphQLObjectType({
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
          type: new GraphQLList(BlogArticle),
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
      description: 'Sample schema',
      query: BlogQuery,
      mutation: BlogMutation,
      subscription: BlogSubscription,
    });

    expect(printSchema(schema)).to.equal(dedent`
      """Sample schema"""
      schema {
        query: Query
        mutation: Mutation
        subscription: Subscription
      }

      type Query {
        article(id: String): Article
        feed: [Article]
      }

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
      expect(schema.getTypeMap()).to.include.keys('TestType');
    });

    it('defines a mutation root', () => {
      const schema = new GraphQLSchema({ mutation: testType });
      expect(schema.getMutationType()).to.equal(testType);
      expect(schema.getTypeMap()).to.include.keys('TestType');
    });

    it('defines a subscription root', () => {
      const schema = new GraphQLSchema({ subscription: testType });
      expect(schema.getSubscriptionType()).to.equal(testType);
      expect(schema.getTypeMap()).to.include.keys('TestType');
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

      expect(schema.isSubType(SomeInterface, SomeSubtype)).to.equal(true);
    });

    it("includes interface's thunk subtypes in the type map", () => {
      const SomeInterface = new GraphQLInterfaceType({
        name: 'SomeInterface',
        fields: {},
        interfaces: () => [AnotherInterface],
      });

      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        fields: {},
      });

      const SomeSubtype = new GraphQLObjectType({
        name: 'SomeSubtype',
        fields: {},
        interfaces: () => [SomeInterface],
      });

      const schema = new GraphQLSchema({ types: [SomeSubtype] });

      expect(schema.getType('SomeInterface')).to.equal(SomeInterface);
      expect(schema.getType('AnotherInterface')).to.equal(AnotherInterface);
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
        locations: [DirectiveLocation.OBJECT],
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

  it('preserves the order of user provided types', () => {
    const aType = new GraphQLObjectType({
      name: 'A',
      fields: {
        sub: { type: new GraphQLScalarType({ name: 'ASub' }) },
      },
    });
    const zType = new GraphQLObjectType({
      name: 'Z',
      fields: {
        sub: { type: new GraphQLScalarType({ name: 'ZSub' }) },
      },
    });
    const queryType = new GraphQLObjectType({
      name: 'Query',
      fields: {
        a: { type: aType },
        z: { type: zType },
        sub: { type: new GraphQLScalarType({ name: 'QuerySub' }) },
      },
    });
    const schema = new GraphQLSchema({
      types: [zType, queryType, aType],
      query: queryType,
    });

    const typeNames = Object.keys(schema.getTypeMap());
    expect(typeNames).to.deep.equal([
      'Z',
      'ZSub',
      'Query',
      'QuerySub',
      'A',
      'ASub',
      'Boolean',
      'String',
      '__Schema',
      '__Type',
      '__TypeKind',
      '__Field',
      '__InputValue',
      '__EnumValue',
      '__Directive',
      '__DirectiveLocation',
    ]);

    // Also check that this order is stable
    const copySchema = new GraphQLSchema(schema.toConfig());
    expect(Object.keys(copySchema.getTypeMap())).to.deep.equal(typeNames);
  });

  it('can be Object.toStringified', () => {
    const schema = new GraphQLSchema({});

    expect(Object.prototype.toString.call(schema)).to.equal(
      '[object GraphQLSchema]',
    );
  });

  describe('getField', () => {
    const petType = new GraphQLInterfaceType({
      name: 'Pet',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const catType = new GraphQLObjectType({
      name: 'Cat',
      interfaces: [petType],
      fields: {
        name: { type: GraphQLString },
      },
    });

    const dogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [petType],
      fields: {
        name: { type: GraphQLString },
      },
    });

    const catOrDog = new GraphQLUnionType({
      name: 'CatOrDog',
      types: [catType, dogType],
    });

    const queryType = new GraphQLObjectType({
      name: 'Query',
      fields: {
        catOrDog: { type: catOrDog },
      },
    });

    const mutationType = new GraphQLObjectType({
      name: 'Mutation',
      fields: {},
    });

    const subscriptionType = new GraphQLObjectType({
      name: 'Subscription',
      fields: {},
    });

    const schema = new GraphQLSchema({
      query: queryType,
      mutation: mutationType,
      subscription: subscriptionType,
    });

    function expectField(parentType: GraphQLCompositeType, name: string) {
      return expect(schema.getField(parentType, name));
    }

    it('returns known fields', () => {
      expectField(petType, 'name').to.equal(petType.getFields().name);
      expectField(catType, 'name').to.equal(catType.getFields().name);

      expectField(queryType, 'catOrDog').to.equal(
        queryType.getFields().catOrDog,
      );
    });

    it('returns `undefined` for unknown fields', () => {
      expectField(catOrDog, 'name').to.equal(undefined);

      expectField(queryType, 'unknown').to.equal(undefined);
      expectField(petType, 'unknown').to.equal(undefined);
      expectField(catType, 'unknown').to.equal(undefined);
      expectField(catOrDog, 'unknown').to.equal(undefined);
    });

    it('handles introspection fields', () => {
      expectField(queryType, '__typename').to.equal(TypeNameMetaFieldDef);
      expectField(mutationType, '__typename').to.equal(TypeNameMetaFieldDef);
      expectField(subscriptionType, '__typename').to.equal(
        TypeNameMetaFieldDef,
      );

      expectField(petType, '__typename').to.equal(TypeNameMetaFieldDef);
      expectField(catType, '__typename').to.equal(TypeNameMetaFieldDef);
      expectField(dogType, '__typename').to.equal(TypeNameMetaFieldDef);
      expectField(catOrDog, '__typename').to.equal(TypeNameMetaFieldDef);

      expectField(queryType, '__type').to.equal(TypeMetaFieldDef);
      expectField(queryType, '__schema').to.equal(SchemaMetaFieldDef);
    });

    it('returns `undefined` for introspection fields in wrong location', () => {
      expectField(petType, '__type').to.equal(undefined);
      expectField(dogType, '__type').to.equal(undefined);
      expectField(mutationType, '__type').to.equal(undefined);
      expectField(subscriptionType, '__type').to.equal(undefined);

      expectField(petType, '__schema').to.equal(undefined);
      expectField(dogType, '__schema').to.equal(undefined);
      expectField(mutationType, '__schema').to.equal(undefined);
      expectField(subscriptionType, '__schema').to.equal(undefined);
    });
  });

  describe('Validity', () => {
    describe('when not assumed valid', () => {
      it('configures the schema to still needing validation', () => {
        const schema = new GraphQLSchema({
          assumeValid: false,
        });
        expect(schema.assumeValid).to.equal(false);
        expect(schema.__validationErrors).to.equal(undefined);
      });

      it('configures the schema to have required validation even once validated', () => {
        const schema = new GraphQLSchema({
          assumeValid: false,
        });
        const validationErrors = validateSchema(schema);
        expect(validationErrors.length).to.be.greaterThan(0);
        expect(validationErrors).to.equal(schema.__validationErrors);
        expect(schema.assumeValid).to.equal(false);
      });
    });

    describe('A Schema must contain uniquely named types', () => {
      it('rejects a Schema which redefines a built-in type', () => {
        const FakeString = new GraphQLScalarType({ name: 'String' });

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
        const schema = new GraphQLSchema({
          assumeValid: true,
        });
        expect(schema.assumeValid).to.equal(true);
        expect(schema.__validationErrors).to.deep.equal([]);
      });
    });
  });
});
