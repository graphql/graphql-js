import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../type/definition';
import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { executeSync } from '../execute';

describe('Execute: Handles execution with a complex schema', () => {
  it('executes using a schema', () => {
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
          resolve: (obj, { width, height }) => obj.pic(width, height),
        },
        recentArticle: { type: BlogArticle },
      }),
    });

    const BlogArticle = new GraphQLObjectType({
      name: 'Article',
      fields: {
        id: { type: new GraphQLNonNull(GraphQLString) },
        isPublished: { type: GraphQLBoolean },
        author: { type: BlogAuthor },
        title: { type: GraphQLString },
        body: { type: GraphQLString },
        keywords: { type: new GraphQLList(GraphQLString) },
      },
    });

    const BlogQuery = new GraphQLObjectType({
      name: 'Query',
      fields: {
        article: {
          type: BlogArticle,
          args: { id: { type: GraphQLID } },
          resolve: (_, { id }) => article(id),
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
            article(10),
          ],
        },
      },
    });

    const BlogSchema = new GraphQLSchema({
      query: BlogQuery,
    });

    function article(id: number) {
      return {
        id,
        isPublished: true,
        author: {
          id: 123,
          name: 'John Smith',
          pic: (width: number, height: number) => getPic(123, width, height),
          recentArticle: () => article(1),
        },
        title: 'My Article ' + id,
        body: 'This is a post',
        hidden: 'This data is not exposed in the schema',
        keywords: ['foo', 'bar', 1, true, null],
      };
    }

    function getPic(uid: number, width: number, height: number) {
      return {
        url: `cdn://${uid}`,
        width: `${width}`,
        height: `${height}`,
      };
    }

    const document = parse(`
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
        notDefined
      }
    `);

    // Note: this is intentionally not validating to ensure appropriate
    // behavior occurs when executing an invalid query.
    expect(executeSync({ schema: BlogSchema, document })).to.deep.equal({
      data: {
        feed: [
          { id: '1', title: 'My Article 1' },
          { id: '2', title: 'My Article 2' },
          { id: '3', title: 'My Article 3' },
          { id: '4', title: 'My Article 4' },
          { id: '5', title: 'My Article 5' },
          { id: '6', title: 'My Article 6' },
          { id: '7', title: 'My Article 7' },
          { id: '8', title: 'My Article 8' },
          { id: '9', title: 'My Article 9' },
          { id: '10', title: 'My Article 10' },
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
              height: 480,
            },
            recentArticle: {
              id: '1',
              isPublished: true,
              title: 'My Article 1',
              body: 'This is a post',
              keywords: ['foo', 'bar', '1', 'true', null],
            },
          },
        },
      },
    });
  });
});
