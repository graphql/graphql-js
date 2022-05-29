import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';

import { DirectiveLocation } from '../../language/directiveLocation';

import { printSchema } from '../../utilities/printSchema';

import type { GraphQLCompositeType, GraphQLObjectType } from '../definition';
import {
  GraphQLInputObjectTypeImpl,
  GraphQLInterfaceTypeImpl,
  GraphQLListImpl,
  GraphQLObjectTypeImpl,
  GraphQLScalarTypeImpl,
  GraphQLUnionTypeImpl,
} from '../definition';
import { GraphQLDirectiveImpl } from '../directives';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from '../introspection';
import { GraphQLBoolean, GraphQLInt, GraphQLString } from '../scalars';
import { GraphQLSchemaImpl } from '../schema';

describe('Type System: Schema', () => {
  it('Define sample schema', () => {
    const BlogImage = new GraphQLObjectTypeImpl({
      name: 'Image',
      fields: {
        url: { type: GraphQLString },
        width: { type: GraphQLInt },
        height: { type: GraphQLInt },
      },
    });

    const BlogAuthor: GraphQLObjectType = new GraphQLObjectTypeImpl({
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

    const BlogArticle: GraphQLObjectType = new GraphQLObjectTypeImpl({
      name: 'Article',
      fields: {
        id: { type: GraphQLString },
        isPublished: { type: GraphQLBoolean },
        author: { type: BlogAuthor },
        title: { type: GraphQLString },
        body: { type: GraphQLString },
      },
    });

    const BlogQuery = new GraphQLObjectTypeImpl({
      name: 'Query',
      fields: {
        article: {
          args: { id: { type: GraphQLString } },
          type: BlogArticle,
        },
        feed: {
          type: new GraphQLListImpl(BlogArticle),
        },
      },
    });

    const BlogMutation = new GraphQLObjectTypeImpl({
      name: 'Mutation',
      fields: {
        writeArticle: {
          type: BlogArticle,
        },
      },
    });

    const BlogSubscription = new GraphQLObjectTypeImpl({
      name: 'Subscription',
      fields: {
        articleSubscribe: {
          args: { id: { type: GraphQLString } },
          type: BlogArticle,
        },
      },
    });

    const schema = new GraphQLSchemaImpl({
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
    const testType = new GraphQLObjectTypeImpl({
      name: 'TestType',
      fields: {},
    });

    it('defines a query root', () => {
      const schema = new GraphQLSchemaImpl({ query: testType });
      expect(schema.getQueryType()).to.equal(testType);
      expect(schema.getTypeMap()).to.include.keys('TestType');
    });

    it('defines a mutation root', () => {
      const schema = new GraphQLSchemaImpl({ mutation: testType });
      expect(schema.getMutationType()).to.equal(testType);
      expect(schema.getTypeMap()).to.include.keys('TestType');
    });

    it('defines a subscription root', () => {
      const schema = new GraphQLSchemaImpl({ subscription: testType });
      expect(schema.getSubscriptionType()).to.equal(testType);
      expect(schema.getTypeMap()).to.include.keys('TestType');
    });
  });

  describe('Type Map', () => {
    it('includes interface possible types in the type map', () => {
      const SomeInterface = new GraphQLInterfaceTypeImpl({
        name: 'SomeInterface',
        fields: {},
      });

      const SomeSubtype = new GraphQLObjectTypeImpl({
        name: 'SomeSubtype',
        fields: {},
        interfaces: [SomeInterface],
      });

      const schema = new GraphQLSchemaImpl({
        query: new GraphQLObjectTypeImpl({
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
      const SomeInterface = new GraphQLInterfaceTypeImpl({
        name: 'SomeInterface',
        fields: {},
        interfaces: () => [AnotherInterface],
      });

      const AnotherInterface = new GraphQLInterfaceTypeImpl({
        name: 'AnotherInterface',
        fields: {},
      });

      const SomeSubtype = new GraphQLObjectTypeImpl({
        name: 'SomeSubtype',
        fields: {},
        interfaces: () => [SomeInterface],
      });

      const schema = new GraphQLSchemaImpl({ types: [SomeSubtype] });

      expect(schema.getType('SomeInterface')).to.equal(SomeInterface);
      expect(schema.getType('AnotherInterface')).to.equal(AnotherInterface);
      expect(schema.getType('SomeSubtype')).to.equal(SomeSubtype);
    });

    it('includes nested input objects in the map', () => {
      const NestedInputObject = new GraphQLInputObjectTypeImpl({
        name: 'NestedInputObject',
        fields: {},
      });

      const SomeInputObject = new GraphQLInputObjectTypeImpl({
        name: 'SomeInputObject',
        fields: { nested: { type: NestedInputObject } },
      });

      const schema = new GraphQLSchemaImpl({
        query: new GraphQLObjectTypeImpl({
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
      const directive = new GraphQLDirectiveImpl({
        name: 'dir',
        locations: [DirectiveLocation.OBJECT],
        args: {
          arg: {
            type: new GraphQLInputObjectTypeImpl({ name: 'Foo', fields: {} }),
          },
          argList: {
            type: new GraphQLListImpl(
              new GraphQLInputObjectTypeImpl({ name: 'Bar', fields: {} }),
            ),
          },
        },
      });
      const schema = new GraphQLSchemaImpl({ directives: [directive] });

      expect(schema.getTypeMap()).to.include.keys('Foo', 'Bar');
    });
  });

  it('preserves the order of user provided types', () => {
    const aType = new GraphQLObjectTypeImpl({
      name: 'A',
      fields: {
        sub: { type: new GraphQLScalarTypeImpl({ name: 'ASub' }) },
      },
    });
    const zType = new GraphQLObjectTypeImpl({
      name: 'Z',
      fields: {
        sub: { type: new GraphQLScalarTypeImpl({ name: 'ZSub' }) },
      },
    });
    const queryType = new GraphQLObjectTypeImpl({
      name: 'Query',
      fields: {
        a: { type: aType },
        z: { type: zType },
        sub: { type: new GraphQLScalarTypeImpl({ name: 'QuerySub' }) },
      },
    });
    const schema = new GraphQLSchemaImpl({
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
    const copySchema = new GraphQLSchemaImpl(schema.toConfig());
    expect(Object.keys(copySchema.getTypeMap())).to.deep.equal(typeNames);
  });

  it('can be Object.toStringified', () => {
    const schema = new GraphQLSchemaImpl({});

    expect(Object.prototype.toString.call(schema)).to.equal(
      '[object GraphQLSchema]',
    );
  });

  describe('getField', () => {
    const petType = new GraphQLInterfaceTypeImpl({
      name: 'Pet',
      fields: {
        name: { type: GraphQLString },
      },
    });

    const catType = new GraphQLObjectTypeImpl({
      name: 'Cat',
      interfaces: [petType],
      fields: {
        name: { type: GraphQLString },
      },
    });

    const dogType = new GraphQLObjectTypeImpl({
      name: 'Dog',
      interfaces: [petType],
      fields: {
        name: { type: GraphQLString },
      },
    });

    const catOrDog = new GraphQLUnionTypeImpl({
      name: 'CatOrDog',
      types: [catType, dogType],
    });

    const queryType = new GraphQLObjectTypeImpl({
      name: 'Query',
      fields: {
        catOrDog: { type: catOrDog },
      },
    });

    const mutationType = new GraphQLObjectTypeImpl({
      name: 'Mutation',
      fields: {},
    });

    const subscriptionType = new GraphQLObjectTypeImpl({
      name: 'Subscription',
      fields: {},
    });

    const schema = new GraphQLSchemaImpl({
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
      expect(schema.getField(petType, '__type')).to.equal(undefined);
      expect(schema.getField(dogType, '__type')).to.equal(undefined);
      expect(schema.getField(mutationType, '__type')).to.equal(undefined);
      expect(schema.getField(subscriptionType, '__type')).to.equal(undefined);

      expect(schema.getField(petType, '__schema')).to.equal(undefined);
      expect(schema.getField(dogType, '__schema')).to.equal(undefined);
      expect(schema.getField(mutationType, '__schema')).to.equal(undefined);
      expect(schema.getField(subscriptionType, '__schema')).to.equal(undefined);
    });
  });

  describe('Validity', () => {
    describe('when not assumed valid', () => {
      it('configures the schema to still needing validation', () => {
        expect(
          new GraphQLSchemaImpl({
            assumeValid: false,
          }).__validationErrors,
        ).to.equal(undefined);
      });

      it('checks the configuration for mistakes', () => {
        // @ts-expect-error
        expect(() => new GraphQLSchemaImpl(JSON.parse)).to.throw();
        // @ts-expect-error
        expect(() => new GraphQLSchemaImpl({ types: {} })).to.throw();
        // @ts-expect-error
        expect(() => new GraphQLSchemaImpl({ directives: {} })).to.throw();
      });
    });

    describe('A Schema must contain uniquely named types', () => {
      it('rejects a Schema which redefines a built-in type', () => {
        const FakeString = new GraphQLScalarTypeImpl({ name: 'String' });

        const QueryType = new GraphQLObjectTypeImpl({
          name: 'Query',
          fields: {
            normal: { type: GraphQLString },
            fake: { type: FakeString },
          },
        });

        expect(() => new GraphQLSchemaImpl({ query: QueryType })).to.throw(
          'Schema must contain uniquely named types but contains multiple types named "String".',
        );
      });

      it('rejects a Schema when a provided type has no name', () => {
        const query = new GraphQLObjectTypeImpl({
          name: 'Query',
          fields: { foo: { type: GraphQLString } },
        });
        const types = [{}, query, {}];

        // @ts-expect-error
        expect(() => new GraphQLSchemaImpl({ query, types })).to.throw(
          'One of the provided types for building the Schema is missing a name.',
        );
      });

      it('rejects a Schema which defines an object type twice', () => {
        const types = [
          new GraphQLObjectTypeImpl({ name: 'SameName', fields: {} }),
          new GraphQLObjectTypeImpl({ name: 'SameName', fields: {} }),
        ];

        expect(() => new GraphQLSchemaImpl({ types })).to.throw(
          'Schema must contain uniquely named types but contains multiple types named "SameName".',
        );
      });

      it('rejects a Schema which defines fields with conflicting types', () => {
        const fields = {};
        const QueryType = new GraphQLObjectTypeImpl({
          name: 'Query',
          fields: {
            a: {
              type: new GraphQLObjectTypeImpl({ name: 'SameName', fields }),
            },
            b: {
              type: new GraphQLObjectTypeImpl({ name: 'SameName', fields }),
            },
          },
        });

        expect(() => new GraphQLSchemaImpl({ query: QueryType })).to.throw(
          'Schema must contain uniquely named types but contains multiple types named "SameName".',
        );
      });
    });

    describe('when assumed valid', () => {
      it('configures the schema to have no errors', () => {
        expect(
          new GraphQLSchemaImpl({
            assumeValid: true,
          }).__validationErrors,
        ).to.deep.equal([]);
      });
    });
  });
});
