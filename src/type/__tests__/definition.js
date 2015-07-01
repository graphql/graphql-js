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

var ObjectType = new GraphQLObjectType({name: 'Object'});
var InterfaceType = new GraphQLInterfaceType({name: 'Interface'});
var UnionType = new GraphQLUnionType({name: 'Union', types: [ObjectType]});
var EnumType = new GraphQLEnumType({name: 'Enum'});
var InputObjectType = new GraphQLInputObjectType({name: 'InputObject'});

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

  it('includes interfaces\' subtypes in the type map', () => {
    var SomeInterface = new GraphQLInterfaceType({
      name: 'SomeInterface',
      fields: {}
    });

    var SomeSubtype = new GraphQLObjectType({
      name: 'SomeSubtype',
      fields: {},
      interfaces: [SomeInterface]
    });

    var schema = new GraphQLSchema({
      query: SomeInterface
    });

    expect(schema.getTypeMap().SomeSubtype).to.equal(SomeSubtype);
  });

  it('stringifies simple types', () => {

    expect('' + GraphQLInt).to.equal('Int');
    expect('' + BlogArticle).to.equal('Article');
    expect('' + InterfaceType).to.equal('Interface');
    expect('' + UnionType).to.equal('Union');
    expect('' + EnumType).to.equal('Enum');
    expect('' + InputObjectType).to.equal('InputObject');
    expect(
      '' + new GraphQLNonNull(GraphQLInt)
    ).to.equal('Int!');
    expect(
      '' + new GraphQLList(GraphQLInt)
    ).to.equal('[Int]');
    expect(
      '' + new GraphQLNonNull(new GraphQLList(GraphQLInt))
    ).to.equal('[Int]!');
    expect(
      '' + new GraphQLList(new GraphQLNonNull(GraphQLInt))
    ).to.equal('[Int!]');
    expect(
      '' + new GraphQLList(new GraphQLList(GraphQLInt))
    ).to.equal('[[Int]]');
  });

  it('identifies input types', () => {
    const expected = [
      [GraphQLInt, true],
      [ObjectType, false],
      [InterfaceType, false],
      [UnionType, false],
      [EnumType, true],
      [InputObjectType, true]
    ];
    expected.forEach(([type, answer]) => {
      expect(isInputType(type)).to.equal(answer);
      expect(isInputType(new GraphQLList(type))).to.equal(answer);
      expect(isInputType(new GraphQLNonNull(type))).to.equal(answer);
    });
  });

  it('identifies output types', () => {
    const expected = [
      [GraphQLInt, true],
      [ObjectType, true],
      [InterfaceType, true],
      [UnionType, true],
      [EnumType, true],
      [InputObjectType, false]
    ];
    expected.forEach(([type, answer]) => {
      expect(isOutputType(type)).to.equal(answer);
      expect(isOutputType(new GraphQLList(type))).to.equal(answer);
      expect(isOutputType(new GraphQLNonNull(type))).to.equal(answer);
    });
  });

  it('prohibits nesting NonNull inside NonNull', () => {
    expect(() => new GraphQLNonNull(new GraphQLNonNull(GraphQLInt)))
      .to.throw(Error, /nest/);
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
    badUnionTypes.forEach((x) => {
      expect(() =>
        new GraphQLUnionType({ name: 'BadUnion', types: [x] })
      ).to.throw(
        `Union BadUnion may only contain object types, it cannot contain: ${x}.`
      );
    });
  });
});
