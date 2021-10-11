# GraphQL.js

The JavaScript reference implementation for GraphQL, a query language for APIs created by Facebook.

[![npm version](https://badge.fury.io/js/graphql.svg)](https://badge.fury.io/js/graphql)
[![Build Status](https://github.com/graphql/graphql-js/workflows/CI/badge.svg?branch=main)](https://github.com/graphql/graphql-js/actions?query=branch%3Amain)
[![Coverage Status](https://codecov.io/gh/graphql/graphql-js/branch/main/graph/badge.svg)](https://codecov.io/gh/graphql/graphql-js)

See more complete documentation at https://graphql.org/ and
https://graphql.org/graphql-js/.

Looking for help? Find resources [from the community](https://graphql.org/community/).

## Getting Started

A general overview of GraphQL is available in the
[README](https://github.com/graphql/graphql-spec/blob/main/README.md) for the
[Specification for GraphQL](https://github.com/graphql/graphql-spec). That overview
describes a simple set of GraphQL examples that exist as [tests](src/__tests__)
in this repository. A good way to get started with this repository is to walk
through that README and the corresponding tests in parallel.

### Using GraphQL.js

Install GraphQL.js from npm

With npm:

```sh
npm install --save graphql
```

or using yarn:

```sh
yarn add graphql
```

GraphQL.js provides two important capabilities: building a type schema and
serving queries against that type schema.

First, build a GraphQL type schema which maps to your codebase.

```js
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';

var schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      hello: {
        type: GraphQLString,
        resolve() {
          return 'world';
        },
      },
    },
  }),
});
```

This defines a simple schema, with one type and one field, that resolves
to a fixed value. The `resolve` function can return a value, a promise,
or an array of promises. A more complex example is included in the top-level [tests](src/__tests__) directory.

Then, serve the result of a query against that type schema.

```js
var query = '{ hello }';

graphql(schema, query).then((result) => {
  // Prints
  // {
  //   data: { hello: "world" }
  // }
  console.log(result);
});
```

This runs a query fetching the one field defined. The `graphql` function will
first ensure the query is syntactically and semantically valid before executing
it, reporting errors otherwise.

```js
var query = '{ BoyHowdy }';

graphql(schema, query).then((result) => {
  // Prints
  // {
  //   errors: [
  //     { message: 'Cannot query field BoyHowdy on RootQueryType',
  //       locations: [ { line: 1, column: 3 } ] }
  //   ]
  // }
  console.log(result);
});
```

**Note**: Please don't forget to set `NODE_ENV=production` if you are running a production server. It will disable some checks that can be useful during development but will significantly improve performance.

### Want to ride the bleeding edge?

The `npm` branch in this repository is automatically maintained to be the last
commit to `main` to pass all tests, in the same form found on npm. It is
recommended to use builds deployed to npm for many reasons, but if you want to use
the latest not-yet-released version of graphql-js, you can do so by depending
directly on this branch:

```
npm install graphql@git://github.com/graphql/graphql-js.git#npm
```

### Experimental features

Each release of GraphQL.js will be accompanied by an experimental release containing support for the `@defer` and `@stream` directive proposal. We are hoping to get community feedback on these releases before the proposal is accepted into the GraphQL specification. You can use this experimental release of GraphQL.js by adding the following to your project's `package.json` file.

```
"graphql": "experimental-stream-defer"
```

Community feedback on this experimental release is much appreciated and can be provided on the [issue created for this purpose](https://github.com/graphql/graphql-js/issues/2848).

### Using in a Browser

GraphQL.js is a general-purpose library and can be used both in a Node server
and in the browser. As an example, the [GraphiQL](https://github.com/graphql/graphiql/)
tool is built with GraphQL.js!

Building a project using GraphQL.js with [webpack](https://webpack.js.org) or
[rollup](https://github.com/rollup/rollup) should just work and only include
the portions of the library you use. This works because GraphQL.js is distributed
with both CommonJS (`require()`) and ESModule (`import`) files. Ensure that any
custom build configurations look for `.mjs` files!

### Contributing

We actively welcome pull requests. Learn how to [contribute](./.github/CONTRIBUTING.md).

This repository is managed by EasyCLA. Project participants must sign the free ([GraphQL Specification Membership agreement](https://preview-spec-membership.graphql.org) before making a contribution. You only need to do this one time, and it can be signed by [individual contributors](http://individual-spec-membership.graphql.org/) or their [employers](http://corporate-spec-membership.graphql.org/).

To initiate the signature process please open a PR against this repo. The EasyCLA bot will block the merge if we still need a membership agreement from you.

You can find [detailed information here](https://github.com/graphql/graphql-wg/tree/main/membership). If you have issues, please email [operations@graphql.org](mailto:operations@graphql.org).

If your company benefits from GraphQL and you would like to provide essential financial support for the systems and people that power our community, please also consider membership in the [GraphQL Foundation](https://foundation.graphql.org/join).

### Changelog

Changes are tracked as [GitHub releases](https://github.com/graphql/graphql-js/releases).

### License

GraphQL.js is [MIT-licensed](./LICENSE).
