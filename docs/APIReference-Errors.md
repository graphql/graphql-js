---
title: graphql/error
layout: ../_core/GraphQLJSLayout
category: API Reference
permalink: /graphql-js/error/
sublinks: formatError,GraphQLError,locatedError,syntaxError
next: /graphql-js/execution/
---

The `graphql/error` module is responsible for creating and formatting
GraphQL errors. You can import either from the `graphql/error` module, or from the root `graphql` module. For example:

```js
import { GraphQLError } from 'graphql'; // ES6
var { GraphQLError } = require('graphql'); // CommonJS
```

## Overview

<ul class="apiIndex">
  <li>
    <a href="#graphqlerror">
      <pre>class GraphQLError</pre>
      A representation of an error that occurred within GraphQL.
    </a>
  </li>
  <li>
    <a href="#syntaxerror">
      <pre>function syntaxError</pre>
      Produces a GraphQLError representing a syntax error.
    </a>
  </li>
  <li>
    <a href="#locatedError">
      <pre>function locatedError</pre>
      Produces a new GraphQLError aware of the location responsible for the error.
    </a>
  </li>
  <li>
    <a href="#formaterror">
      <pre>function formatError</pre>
      Format an error according to the rules described by the Response Format.
    </a>
  </li>
</ul>

## Errors

### GraphQLError

```js
class GraphQLError extends Error {
 constructor(
   message: string,
   nodes?: Array<any>,
   stack?: ?string,
   source?: Source,
   positions?: Array<number>,
   originalError?: ?Error,
   extensions?: ?{ [key: string]: mixed }
 )
}
```

A representation of an error that occurred within GraphQL. Contains
information about where in the query the error occurred for debugging. Most
commonly constructed with `locatedError` below.

### syntaxError

```js
function syntaxError(
  source: Source,
  position: number,
  description: string
): GraphQLError;
```

Produces a GraphQLError representing a syntax error, containing useful
descriptive information about the syntax error's position in the source.

### locatedError

```js
function locatedError(error: ?Error, nodes: Array<any>): GraphQLError {
```

Given an arbitrary Error, presumably thrown while attempting to execute a
GraphQL operation, produce a new GraphQLError aware of the location in the
document responsible for the original Error.

### formatError

```js
function formatError(error: GraphQLError): GraphQLFormattedError

type GraphQLFormattedError = {
  message: string,
  locations: ?Array<GraphQLErrorLocation>
};

type GraphQLErrorLocation = {
  line: number,
  column: number
};
```

Given a GraphQLError, format it according to the rules described by the
Response Format, Errors section of the GraphQL Specification.
