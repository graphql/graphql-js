/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { execute } from '../execute';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,
} from '../../type';


describe('Execute: Handles execution with a complex schema', () => {
  it('executes using a schema', async () => {

    const BlogImage = new GraphQLObjectType({
      name: 'Image',
      fields: {
        url: { type: GraphQLString },
        width: { type: GraphQLInt },
        height: { type: GraphQLInt },
      }
    });

    const BlogAuthor = new GraphQLObjectType({
      name: 'Author',
      fields: () => ({
        id: { type: GraphQLString },
        name: { type: GraphQLString },
        pic: {
          args: { width: { type: GraphQLInt }, height: { type: GraphQLInt } },
          type: BlogImage,
          resolve: (obj, { width, height }) => obj.pic(width, height)
        },
        recentArticle: { type: BlogArticle }
      })
    });

    const BlogArticle = new GraphQLObjectType({
      name: 'Article',
      fields: {
        id: { type: new GraphQLNonNull(GraphQLString) },
        isPublished: { type: GraphQLBoolean },
        author: { type: BlogAuthor },
        title: { type: GraphQLString },
        body: { type: GraphQLString },
        keywords: { type: new GraphQLList(GraphQLString) }
      }
    });

    const BlogQuery = new GraphQLObjectType({
      name: 'Query',
      fields: {
        article: {
          type: BlogArticle,
          args: { id: { type: GraphQLID } },
          resolve: (_, { id }) => article(id)
        },
        feed: {
          type: new GraphQLList(BlogArticle),
          resolve: () => [
            article(1),
            article(2),
            article(3),
            article(4),
            article(5),
            article(6),
            article(7),
            article(8),
            article(9),
            article(10)
          ]
        }
      }
    });

    const BlogSchema = new GraphQLSchema({
      query: BlogQuery
    });

    function article(id) {
      return {
        id,
        isPublished: 'true',
        author: johnSmith,
        title: 'My Article ' + id,
        body: 'This is a post',
        hidden: 'This data is not exposed in the schema',
        keywords: [ 'foo', 'bar', 1, true, null ]
      };
    }

    const johnSmith = {
      id: 123,
      name: 'John Smith',
      pic: (width, height) => getPic(123, width, height),
      recentArticle: article(1)
    };

    function getPic(uid, width, height) {
      return {
        url: `cdn://${uid}`,
        width: `${width}`,
        height: `${height}`
      };
    }

    const request = `
      {
        feed {
          id,
          title
        },
        article(id: "1") {
          ...articleFields,
          author {
            id,
            name,
            pic(width: 640, height: 480) {
              url,
              width,
              height
            },
            recentArticle {
              ...articleFields,
              keywords
            }
          }
        }
      }

      fragment articleFields on Article {
        id,
        isPublished,
        title,
        body,
        hidden,
        notdefined
      }
    `;

    // Note: this is intentionally not validating to ensure appropriate
    // behavior occurs when executing an invalid query.
    return expect(
      await execute(BlogSchema, parse(request))
    ).to.deep.equal({
      data: {
        feed: [
          { id: '1',
            title: 'My Article 1' },
          { id: '2',
            title: 'My Article 2' },
          { id: '3',
            title: 'My Article 3' },
          { id: '4',
            title: 'My Article 4' },
          { id: '5',
            title: 'My Article 5' },
          { id: '6',
            title: 'My Article 6' },
          { id: '7',
            title: 'My Article 7' },
          { id: '8',
            title: 'My Article 8' },
          { id: '9',
            title: 'My Article 9' },
          { id: '10',
            title: 'My Article 10' }
        ],
        article: {
          id: '1',
          isPublished: true,
          title: 'My Article 1',
          body: 'This is a post',
          author: {
            id: '123',
            name: 'John Smith',
            pic: {
              url: 'cdn://123',
              width: 640,
              height: 480
            },
            recentArticle: {
              id: '1',
              isPublished: true,
              title: 'My Article 1',
              body: 'This is a post',
              keywords: [ 'foo', 'bar', '1', 'true', null ]
            }
          }
        }
      }
    });
  });
});
