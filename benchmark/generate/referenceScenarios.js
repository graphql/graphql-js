import * as execution from 'graphql/execution/index.js';
import { parse } from 'graphql/language/parser.js';
import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from 'graphql/type/definition.js';
import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from 'graphql/type/scalars.js';
import { GraphQLSchema } from 'graphql/type/schema.js';

import { createGeneratedExecution } from './generatedExecution.js';

export const blogVariables = { id: '2', width: 300, height: 500 };

export async function createGeneratedBenchmark({
  document,
  importMetaURL,
  name,
  schema,
  tmpName,
  variableValues,
}) {
  const generated = await createGeneratedExecution(
    execution,
    { schema, document },
    { schema },
    importMetaURL,
    tmpName,
  );
  const compiled =
    generated ??
    (typeof execution.compileExecution === 'function'
      ? execution.compileExecution({ schema, document })
      : undefined);
  if (Array.isArray(compiled)) {
    throw compiled[0];
  }

  return {
    name,
    measure: () => {
      const runtimeArgs = { variableValues };
      if (compiled !== undefined) {
        return 'execute' in compiled
          ? compiled.execute(runtimeArgs)
          : compiled.executeRootSelectionSet(runtimeArgs);
      }

      return execution.execute({ schema, document, variableValues });
    },
  };
}

export function createFewResolversSchema() {
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
        resolve: (obj, { width, height }) => obj.pic(width, height),
      },
      recentArticle: { type: BlogArticle },
    }),
  });

  const BlogArticle = new GraphQLObjectType({
    name: 'Article',
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
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
        resolve: (_source, { id }) => article(id),
      },
      feed: {
        type: new GraphQLList(BlogArticle),
        resolve: () =>
          Promise.resolve([
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
          ]),
      },
    },
  });

  const johnSmith = {
    id: 123,
    name: 'John Smith',
    pic: (width, height) => getPic(123, width, height),
    recentArticle: null,
  };
  johnSmith.recentArticle = article(1);

  function article(id) {
    return {
      id,
      isPublished: true,
      author: johnSmith,
      title: 'My Article ' + String(id),
      body: 'This is a post',
      hidden: 'This data is not exposed in the schema',
      keywords: ['foo', 'bar', 1, true, null],
    };
  }

  function getPic(uid, width, height) {
    return {
      url: `cdn://${uid}`,
      width: `${width}`,
      height: `${height}`,
    };
  }

  return new GraphQLSchema({ query: BlogQuery });
}

export const fewResolversDocument = parse(`
  query ($id: ID! = "1", $width: Int = 640, $height: Int = 480) {
    feed {
      __typename
      id
      title
    }
    article(id: $id) {
      ...articleFields
      author {
        __typename
        id
        name
        pic(width: $width, height: $height) {
          __typename
          url
          width
          height
        }
        recentArticle {
          ...articleFields
          keywords
        }
      }
    }
  }

  fragment articleFields on Article {
    __typename
    id
    isPublished
    title
    body
    hidden
    notdefined
  }
`);

export function createManyResolversSchema() {
  const BlogImage = new GraphQLObjectType({
    name: 'Image',
    fields: {
      url: {
        type: GraphQLString,
        resolve: (image) => Promise.resolve(image.url),
      },
      width: {
        type: GraphQLInt,
        resolve: (image) => Promise.resolve(image.width),
      },
      height: {
        type: GraphQLInt,
        resolve: (image) => Promise.resolve(image.height),
      },
    },
  });

  const BlogAuthor = new GraphQLObjectType({
    name: 'Author',
    fields: () => ({
      id: {
        type: GraphQLString,
        resolve: (author) => Promise.resolve(author.id),
      },
      name: {
        type: GraphQLString,
        resolve: (author) => Promise.resolve(author.name),
      },
      pic: {
        args: { width: { type: GraphQLInt }, height: { type: GraphQLInt } },
        type: BlogImage,
        resolve: (obj, { width, height }) => obj.pic(width, height),
      },
      recentArticle: {
        type: BlogArticle,
        resolve: (author) => Promise.resolve(author.recentArticle),
      },
    }),
  });

  const BlogArticle = new GraphQLObjectType({
    name: 'Article',
    fields: {
      id: {
        type: new GraphQLNonNull(GraphQLID),
        resolve: (blogArticle) => Promise.resolve(blogArticle.id),
      },
      isPublished: {
        type: GraphQLBoolean,
        resolve: (blogArticle) => Promise.resolve(blogArticle.isPublished),
      },
      author: { type: BlogAuthor },
      title: {
        type: GraphQLString,
        resolve: (blogArticle) =>
          Promise.resolve(blogArticle && blogArticle.title),
      },
      body: {
        type: GraphQLString,
        resolve: (blogArticle) => Promise.resolve(blogArticle.body),
      },
      keywords: {
        type: new GraphQLList(GraphQLString),
        resolve: (blogArticle) => Promise.resolve(blogArticle.keywords),
      },
    },
  });

  const BlogQuery = new GraphQLObjectType({
    name: 'Query',
    fields: {
      article: {
        type: BlogArticle,
        args: { id: { type: GraphQLID } },
        resolve: (_source, { id }) => article(id),
      },
      feed: {
        type: new GraphQLList(BlogArticle),
        resolve: () =>
          Promise.resolve([
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
          ]),
      },
    },
  });

  const johnSmith = {
    id: 123,
    name: 'John Smith',
    pic: (width, height) => getPic(123, width, height),
    recentArticle: null,
  };
  johnSmith.recentArticle = article(1);

  function article(id) {
    return {
      id,
      isPublished: true,
      author: johnSmith,
      title: 'My Article ' + String(id),
      body: 'This is a post',
      hidden: 'This data is not exposed in the schema',
      keywords: ['foo', 'bar', 1, true, null],
    };
  }

  function getPic(uid, width, height) {
    return {
      url: `cdn://${uid}`,
      width: `${width}`,
      height: `${height}`,
    };
  }

  return new GraphQLSchema({ query: BlogQuery });
}

export const manyResolversDocument = parse(`
  query ($id: ID! = "1", $width: Int = 640, $height: Int = 480) {
    feed {
      __typename
      id
      title
    }
    article(id: $id) {
      ...articleFields
      author {
        __typename
        id
        name
        pic(width: $width, height: $height) {
          __typename
          url
          width
          height
        }
        articles {
          ...articleFields
          keywords
          badges {
            color
            text
          }
          adverts {
            text
            image {
              url
              width
              height
            }
          }
        }
      }
    }
  }

  fragment articleFields on Article {
    __typename
    id
    isPublished
    title
    body
    hidden
    notdefined
  }
`);

export function createNestedArraysSchema() {
  const articlesCount = 25;
  const badgesCount = 25;
  const advertsCount = 25;

  const BlogImage = new GraphQLObjectType({
    name: 'Image',
    fields: {
      url: {
        type: GraphQLString,
        resolve: (image) => Promise.resolve(image.url),
      },
      width: {
        type: GraphQLInt,
        resolve: (image) => Promise.resolve(image.width),
      },
      height: {
        type: GraphQLInt,
        resolve: (image) => Promise.resolve(image.height),
      },
    },
  });

  const articles = [];
  const badges = [];
  const adverts = [];

  const BlogAuthor = new GraphQLObjectType({
    name: 'Author',
    fields: () => ({
      id: {
        type: GraphQLString,
        resolve: (author) => Promise.resolve(author.id),
      },
      name: {
        type: GraphQLString,
        resolve: (author) => Promise.resolve(author.name),
      },
      pic: {
        args: { width: { type: GraphQLInt }, height: { type: GraphQLInt } },
        type: BlogImage,
        resolve: (obj, { width, height }) => obj.pic(width, height),
      },
      articles: {
        type: new GraphQLList(BlogArticle),
        resolve: () => Promise.resolve(articles),
      },
    }),
  });

  const BlogArticleBadge = new GraphQLObjectType({
    name: 'ArticleBadge',
    fields: {
      color: {
        type: GraphQLString,
        resolve: (badge) => Promise.resolve(badge && badge.color),
      },
      text: {
        type: GraphQLString,
        resolve: (badge) => Promise.resolve(badge && badge.text),
      },
    },
  });

  const BlogArticleAdvert = new GraphQLObjectType({
    name: 'ArticleAdvert',
    fields: {
      text: {
        type: GraphQLString,
        resolve: (advert) => Promise.resolve(advert && advert.text),
      },
      image: {
        type: BlogImage,
        resolve: (advert) => Promise.resolve(advert && advert.image),
      },
    },
  });

  const BlogArticle = new GraphQLObjectType({
    name: 'Article',
    fields: {
      id: {
        type: new GraphQLNonNull(GraphQLID),
        resolve: (blogArticle) => Promise.resolve(blogArticle.id),
      },
      isPublished: {
        type: GraphQLBoolean,
        resolve: (blogArticle) => Promise.resolve(blogArticle.isPublished),
      },
      author: { type: BlogAuthor },
      title: {
        type: GraphQLString,
        resolve: (blogArticle) =>
          Promise.resolve(blogArticle && blogArticle.title),
      },
      body: {
        type: GraphQLString,
        resolve: (blogArticle) => Promise.resolve(blogArticle.body),
      },
      keywords: {
        type: new GraphQLList(GraphQLString),
        resolve: (blogArticle) => Promise.resolve(blogArticle.keywords),
      },
      badges: { type: new GraphQLList(BlogArticleBadge) },
      adverts: { type: new GraphQLList(BlogArticleAdvert) },
    },
  });

  const BlogQuery = new GraphQLObjectType({
    name: 'Query',
    fields: {
      article: {
        type: BlogArticle,
        args: { id: { type: GraphQLID } },
        resolve: (_source, { id }) => article(id),
      },
      feed: {
        type: new GraphQLList(BlogArticle),
        resolve: () =>
          Promise.resolve([
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
          ]),
      },
    },
  });

  for (let i = 0; i < badgesCount; i++) {
    badges.push({ color: 'color' + String(i), text: 'text' + String(i) });
  }

  for (let i = 0; i < advertsCount; i++) {
    adverts.push({ text: 'text' + String(i), image: getPic(i, 100, 200) });
  }

  const johnSmith = {
    id: 123,
    name: 'John Smith',
    pic: (width, height) => getPic(123, width, height),
    recentArticle: null,
  };
  johnSmith.recentArticle = article(1);

  function article(id) {
    return {
      id,
      isPublished: true,
      author: johnSmith,
      title: 'My Article ' + String(id),
      body: 'This is a post',
      hidden: 'This data is not exposed in the schema',
      keywords: ['foo', 'bar', 1, true, null],
      badges,
      adverts,
    };
  }

  for (let i = 0; i < articlesCount; i++) {
    articles.push(article(i));
  }

  function getPic(uid, width, height) {
    return {
      url: `cdn://${uid}`,
      width: `${width}`,
      height: `${height}`,
    };
  }

  return new GraphQLSchema({ query: BlogQuery });
}

export const nestedArraysDocument = parse(`
  query ($id: ID! = "1", $width: Int = 640, $height: Int = 480) {
    feed {
      __typename
      id
      title
    }
    article(id: $id) {
      ...articleFields
      author {
        __typename
        id
        name
        pic(width: $width, height: $height) {
          __typename
          url
          width
          height
        }
        articles {
          ...articleFields
          keywords
          badges {
            color
            text
          }
          adverts {
            text
            image {
              url
              width
              height
            }
          }
        }
      }
    }
  }

  fragment articleFields on Article {
    __typename
    id
    isPublished
    title
    body
    hidden
    notdefined
  }
`);
