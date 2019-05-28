---
title: graphql/execution
layout: ../_core/GraphQLJSLayout
category: API Reference
permalink: /graphql-js/execution/
sublinks: execute
next: /graphql-js/language/
---

The `graphql/execution` module is responsible for the execution phase of
fulfilling a GraphQL request. You can import either from the `graphql/execution` module, or from the root `graphql` module. For example:

```js
import { execute } from 'graphql'; // ES6
var { execute } = require('graphql'); // CommonJS
```

## Overview

<ul class="apiIndex">
  <li>
    <a href="#execute">
      <pre>function execute</pre>
      Executes a GraphQL request on the provided schema.
    </a>
  </li>
</ul>

## Execution

### execute

```js
export function execute(
  schema: GraphQLSchema,
  documentAST: Document,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
): MaybePromise<ExecutionResult>

type MaybePromise<T> = Promise<T> | T;

type ExecutionResult = {
  data: ?Object;
  errors?: Array<GraphQLError>;
}
```

Implements the "Evaluating requests" section of the GraphQL specification.

Returns a Promise that will eventually be resolved and never rejected.

If the arguments to this function do not result in a legal execution context,
a GraphQLError will be thrown immediately explaining the invalid input.

`ExecutionResult` represents the result of execution. `data` is the result of
executing the query, `errors` is null if no errors occurred, and is a
non-empty array if an error occurred.
