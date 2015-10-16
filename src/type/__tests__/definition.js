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
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLUnionType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLString,
  GraphQLBoolean
} from '../';

import { describe, it } from 'mocha';
import { expect } from 'chai';

import { isInputType, isOutputType } from '../definition';

var BlogImage = new GraphQLObjectType({
  name: 'Image',
  fields: {
    url: { type: GraphQLString },
    width: { type: GraphQLInt },
    height: { type: GraphQLInt },
  }
});

var BlogAuthor = new GraphQLObjectType({
  name: 'Author',
  fields: () => ({
    id: { type: GraphQLString },
    name: { type: GraphQLString },
    pic: {
      args: { width: { type: GraphQLInt }, height: { type: GraphQLInt } },
      type: BlogImage
    },
    recentArticle: { type: BlogArticle }
  })
});

var BlogArticle = new GraphQLObjectType({
  name: 'Article',
  fields: {
    id: { type: GraphQLString },
    isPublished: { type: GraphQLBoolean },
    author: { type: BlogAuthor },
    title: { type: GraphQLString },
    body: { type: GraphQLString }
  }
});

var BlogQuery = new GraphQLObjectType({
  name: 'Query',
  fields: {
    article: {
      args: { id: { type: GraphQLString } },
      type: BlogArticle
    },
    feed: {
      type: new GraphQLList(BlogArticle)
    }
  }
});

var BlogMutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    writeArticle: {
      type: BlogArticle
    },
  }
});

var BlogSubscription = new GraphQLObjectType({
  name: 'Subscription',
  fields: {
    articleSubscribe: {
      args: { id: { type: GraphQLString } },
      type: BlogArticle
    }
  }
});

var ObjectType = new GraphQLObjectType({
  name: 'Object',
  isTypeOf: () => true
});
var InterfaceType = new GraphQLInterfaceType({ name: 'Interface' });
var UnionType = new GraphQLUnionType({ name: 'Union', types: [ ObjectType ] });
var EnumType = new GraphQLEnumType({ name: 'Enum', values: { foo: {} } });
var InputObjectType = new GraphQLInputObjectType({ name: 'InputObject' });

describe('Type System: Example', () => {
  it('defines a query only schema', () => {
    var BlogSchema = new GraphQLSchema({
      query: BlogQuery
    });

    expect(BlogSchema.getQueryType()).to.equal(BlogQuery);

    var articleField = BlogQuery.getFields()[('article' : string)];
    expect(articleField && articleField.type).to.equal(BlogArticle);
    expect(articleField && articleField.type.name).to.equal('Article');
    expect(articleField && articleField.name).to.equal('article');

    var articleFieldType = articleField ? articleField.type : null;

    var titleField = articleFieldType instanceof GraphQLObjectType &&
      articleFieldType.getFields()[('title': string)];
    expect(titleField && titleField.name).to.equal('title');
    expect(titleField && titleField.type).to.equal(GraphQLString);
    expect(titleField && titleField.type.name).to.equal('String');

    var authorField = articleFieldType instanceof GraphQLObjectType &&
      articleFieldType.getFields()[('author': string)];

    var authorFieldType = authorField ? authorField.type : null;
    var recentArticleField = authorFieldType instanceof GraphQLObjectType &&
      authorFieldType.getFields()[('recentArticle': string)];

    expect(recentArticleField && recentArticleField.type).to.equal(BlogArticle);

    var feedField = BlogQuery.getFields()[('feed' : string)];
    expect(
      feedField && (feedField.type: GraphQLList).ofType
    ).to.equal(BlogArticle);
    expect(feedField && feedField.name).to.equal('feed');

  });

  it('defines a mutation schema', () => {
    var BlogSchema = new GraphQLSchema({
      query: BlogQuery,
      mutation: BlogMutation
    });

    expect(BlogSchema.getMutationType()).to.equal(BlogMutation);

    var writeMutation = BlogMutation.getFields()[('writeArticle' : string)];
    expect(writeMutation && writeMutation.type).to.equal(BlogArticle);
    expect(writeMutation && writeMutation.type.name).to.equal('Article');
    expect(writeMutation && writeMutation.name).to.equal('writeArticle');

  });

  it('defines a subscription schema', () => {
    var BlogSchema = new GraphQLSchema({
      query: BlogQuery,
      subscription: BlogSubscription
    });

    expect(BlogSchema.getSubscriptionType()).to.equal(BlogSubscription);

    var sub = BlogSubscription.getFields()[('articleSubscribe' : string)];
    expect(sub && sub.type).to.equal(BlogArticle);
    expect(sub && sub.type.name).to.equal('Article');
    expect(sub && sub.name).to.equal('articleSubscribe');

  });

  it('includes nested input objects in the map', () => {
    var NestedInputObject = new GraphQLInputObjectType({
      name: 'NestedInputObject',
      fields: { value: { type: GraphQLString } }
    });
    var SomeInputObject = new GraphQLInputObjectType({
      name: 'SomeInputObject',
      fields: { nested: { type: NestedInputObject } }
    });
    var SomeMutation = new GraphQLObjectType({
      name: 'SomeMutation',
      fields: {
        mutateSomething: {
          type: BlogArticle,
          args: { input: { type: SomeInputObject } }
        }
      }
    });
    var SomeSubscription = new GraphQLObjectType({
      name: 'SomeSubscription',
      fields: {
        subscribeToSomething: {
          type: BlogArticle,
          args: { input: { type: SomeInputObject } }
        }
      }
    });
    var schema = new GraphQLSchema({
      query: BlogQuery,
      mutation: SomeMutation,
      subscription: SomeSubscription
    });
    expect(schema.getTypeMap().NestedInputObject).to.equal(NestedInputObject);
  });

  it('includes interfaces\' subtypes in the type map', () => {
    var SomeInterface = new GraphQLInterfaceType({
      name: 'SomeInterface',
      fields: {
        f: { type: GraphQLInt }
      }
    });

    var SomeSubtype = new GraphQLObjectType({
      name: 'SomeSubtype',
      fields: {
        f: { type: GraphQLInt }
      },
      interfaces: [ SomeInterface ],
      isTypeOf: () => true
    });

    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          iface: { type: SomeInterface }
        }
      })
    });

    expect(schema.getTypeMap().SomeSubtype).to.equal(SomeSubtype);
  });

  it('includes interfaces\' thunk subtypes in the type map', () => {
    var SomeInterface = new GraphQLInterfaceType({
      name: 'SomeInterface',
      fields: {
        f: { type: GraphQLInt }
      }
    });

    var SomeSubtype = new GraphQLObjectType({
      name: 'SomeSubtype',
      fields: {
        f: { type: GraphQLInt }
      },
      interfaces: () => [ SomeInterface ],
      isTypeOf: () => true
    });

    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          iface: { type: SomeInterface }
        }
      })
    });

    expect(schema.getTypeMap().SomeSubtype).to.equal(SomeSubtype);
  });


  it('stringifies simple types', () => {

    expect(String(GraphQLInt)).to.equal('Int');
    expect(String(BlogArticle)).to.equal('Article');
    expect(String(InterfaceType)).to.equal('Interface');
    expect(String(UnionType)).to.equal('Union');
    expect(String(EnumType)).to.equal('Enum');
    expect(String(InputObjectType)).to.equal('InputObject');
    expect(
      String(new GraphQLNonNull(GraphQLInt))
    ).to.equal('Int!');
    expect(
      String(new GraphQLList(GraphQLInt))
    ).to.equal('[Int]');
    expect(
      String(new GraphQLNonNull(new GraphQLList(GraphQLInt)))
    ).to.equal('[Int]!');
    expect(
      String(new GraphQLList(new GraphQLNonNull(GraphQLInt)))
    ).to.equal('[Int!]');
    expect(
      String(new GraphQLList(new GraphQLList(GraphQLInt)))
    ).to.equal('[[Int]]');
  });

  it('identifies input types', () => {
    const expected = [
      [ GraphQLInt, true ],
      [ ObjectType, false ],
      [ InterfaceType, false ],
      [ UnionType, false ],
      [ EnumType, true ],
      [ InputObjectType, true ]
    ];
    expected.forEach(([ type, answer ]) => {
      expect(isInputType(type)).to.equal(answer);
      expect(isInputType(new GraphQLList(type))).to.equal(answer);
      expect(isInputType(new GraphQLNonNull(type))).to.equal(answer);
    });
  });

  it('identifies output types', () => {
    const expected = [
      [ GraphQLInt, true ],
      [ ObjectType, true ],
      [ InterfaceType, true ],
      [ UnionType, true ],
      [ EnumType, true ],
      [ InputObjectType, false ]
    ];
    expected.forEach(([ type, answer ]) => {
      expect(isOutputType(type)).to.equal(answer);
      expect(isOutputType(new GraphQLList(type))).to.equal(answer);
      expect(isOutputType(new GraphQLNonNull(type))).to.equal(answer);
    });
  });

  it('prohibits nesting NonNull inside NonNull', () => {
    expect(() =>
      new GraphQLNonNull(new GraphQLNonNull(GraphQLInt))
    ).to.throw(
      'Can only create NonNull of a Nullable GraphQLType but got: Int!.'
    );
  });

  it('prohibits putting non-Object types in unions', () => {
    const badUnionTypes = [
      GraphQLInt,
      new GraphQLNonNull(GraphQLInt),
      new GraphQLList(GraphQLInt),
      InterfaceType,
      UnionType,
      EnumType,
      InputObjectType
    ];
    badUnionTypes.forEach(x => {
      expect(() =>
        new GraphQLUnionType({ name: 'BadUnion', types: [ x ] })
      ).to.throw(
        `BadUnion may only contain Object types, it cannot contain: ${x}.`
      );
    });
  });

  it('does not mutate passed field definitions', () => {
    const fields = {
      field1: {
        type: GraphQLString,
      },
      field2: {
        type: GraphQLString,
        args: {
          id: {
            type: GraphQLString
          }
        }
      }
    };
    const testObject1 = new GraphQLObjectType({
      name: 'Test1',
      fields,
    });
    const testObject2 = new GraphQLObjectType({
      name: 'Test2',
      fields,
    });

    expect(testObject1.getFields()).to.deep.equal(testObject2.getFields());
    expect(fields).to.deep.equal({
      field1: {
        type: GraphQLString,
      },
      field2: {
        type: GraphQLString,
        args: {
          id: {
            type: GraphQLString
          }
        }
      }
    });

    const testInputObject1 = new GraphQLInputObjectType({
      name: 'Test1',
      fields
    });
    const testInputObject2 = new GraphQLInputObjectType({
      name: 'Test2',
      fields
    });

    expect(testInputObject1.getFields()).to.deep.equal(
      testInputObject2.getFields()
    );
    expect(fields).to.deep.equal({
      field1: {
        type: GraphQLString,
      },
      field2: {
        type: GraphQLString,
        args: {
          id: {
            type: GraphQLString
          }
        }
      }
    });
  });
});
