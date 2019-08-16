# GraphQL.js

The JavaScript reference implementation for GraphQL, a query language for APIs created by Facebook.

[![Build Status](https://dev.azure.com/apollographql/graphql-js/_apis/build/status/apollographql.graphql-js?branchName=master)](https://dev.azure.com/apollographql/graphql-js/_build/latest?definitionId=2&branchName=master)
[![npm version](https://badge.fury.io/js/%40apollo%2Fgraphql.svg)](https://badge.fury.io/js/%40apollo%2Fgraphql)

See more complete documentation at https://graphql.org/ and
https://graphql.org/graphql-js/.

Looking for help? Find resources [from the community](https://graphql.org/community/).

## Getting Started

An overview of GraphQL in general is available in the
[README](https://github.com/graphql/graphql-spec/blob/master/README.md) for the
[Specification for GraphQL](https://github.com/graphql/graphql-spec). That overview
describes a simple set of GraphQL examples that exist as [tests](src/__tests__)
in this repository. A good way to get started with this repository is to walk
through that README and the corresponding tests in parallel.

### Using GraphQL.js

Install GraphQL.js from npm

With yarn:

```sh
yarn add graphql
```

or alternatively using npm:

```sh
npm install --save graphql
```

GraphQL.js provides two important capabilities: building a type schema, and
serving queries against that type schema.

First, build a GraphQL type schema which maps to your code base.

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

This defines a simple schema with one type and one field, that resolves
to a fixed value. The `resolve` function can return a value, a promise,
or an array of promises. A more complex example is included in the top
level [tests](src/__tests__) directory.

Then, serve the result of a query against that type schema.

```js
var query = '{ hello }';

graphql(schema, query).then(result => {
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
var query = '{ boyhowdy }';

graphql(schema, query).then(result => {
  // Prints
  // {
  //   errors: [
  //     { message: 'Cannot query field boyhowdy on RootQueryType',
  //       locations: [ { line: 1, column: 3 } ] }
  //   ]
  // }
  console.log(result);
});
```

### Want to ride the bleeding edge?

The `npm` branch in this repository is automatically maintained to be the last
commit to `master` to pass all tests, in the same form found on npm. It is
recommended to use builds deployed to npm for many reasons, but if you want to use
the latest not-yet-released version of graphql-js, you can do so by depending
directly on this branch:

```
npm install graphql@git://github.com/graphql/graphql-js.git#npm
```

### Using in a Browser

GraphQL.js is a general purpose library and can be used both in a Node server
and in the browser. As an example, the [GraphiQL](https://github.com/graphql/graphiql/)
tool is built with GraphQL.js!

Building a project using GraphQL.js with [webpack](https://webpack.js.org) or
[rollup](https://github.com/rollup/rollup) should just work and only include
the portions of the library you use. This works because GraphQL.js is distributed
with both CommonJS (`require()`) and ESModule (`import`) files. Ensure that any
custom build configurations look for `.mjs` files!

### Contributing

[Read the Apollo Contributor Guidelines.](https://github.com/graphql/graphql-js/blob/master/.github/CONTRIBUTING.md)

#### TypeScript

Part of this fork's purpose is to begin a gradual migration of `graphql-js` from Flow to TypeScript. Some parts have already been converted, and some remain to be converted. The steps for converting a file from Flow to TypeScript are as follows:

1. Rename the file, and convert syntax to TypeScript: `Foo.js` becomes `Foo.ts`, and any Flow specific syntax should be transalted.
2. Create a `Foo.js.flow` type declaration file for the file's exports (`Foo.d.ts`, if present, can be helpful for guiding this process). Make sure you prefix the file with `// @flow`, or else strange things will happen!
3. Delete the `Foo.d.ts` file, if it exists.
4. Run `npm run check`, and ensure both `flow` and `tsc` typecheck the project without issue.

Check out [45da517](https://github.com/apollographql/graphql-js/commit/45da517f32e15c0b8c0356fb4c4d95e959e3df91) for an example of this process.

### Changelog

Changes are tracked as [GitHub releases](https://github.com/graphql/graphql-js/releases).

### License

GraphQL.js is [MIT-licensed](https://github.com/graphql/graphql-js/blob/master/LICENSE).

### Credits

The `.d.ts` files in this project are, in part, from `@types/graphql`, written by:

- TonyYang https://github.com/TonyPythoneer
- Caleb Meredith https://github.com/calebmer
- Dominic Watson https://github.com/intellix
- Firede https://github.com/firede
- Kepennar https://github.com/kepennar
- Mikhail Novikov https://github.com/freiksenet
- Ivan Goncharov https://github.com/IvanGoncharov
- Hagai Cohen https://github.com/DxCx
- Ricardo Portugal https://github.com/rportugal
- Tim Griesser https://github.com/tgriesser
- Dylan Stewart https://github.com/dyst5422
- Alessio Dionisi https://github.com/adnsio
- Divyendu Singh https://github.com/divyenduz
- Brad Zacher https://github.com/bradzacher
- Curtis Layne https://github.com/clayne11
- Jonathan Cardoso https://github.com/JCMais
- Pavel Lang https://github.com/langpavel
- Mark Caudill https://github.com/mc0
- Martijn Walraven https://github.com/martijnwalraven
- Jed Mao https://github.com/jedmao

And licensed under the [MIT License](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/LICENSE).

Thanks to all the above contributors!
