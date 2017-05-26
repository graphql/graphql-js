GraphQL JS
----------

The primary `graphql` module includes everything you need to define a GraphQL
schema and fulfill GraphQL requests.

```js
import { ... } from 'graphql'; // ES6
var GraphQL = require('graphql'); // CommonJS
```

Each sub directory within is a sub-module of graphql-js:

* [`graphql/language`](src/language/README.md): Parse and operate on the
  GraphQL language.
* [`graphql/type`](src/type/README.md): Define GraphQL types and schema.
* [`graphql/validation`](src/validation/README.md): The Validation phase of
  fulfilling a GraphQL result.
* [`graphql/execution`](src/execution/README.md): The Execution phase of
  fulfilling a GraphQL request.
* [`graphql/error`](src/error/README.md): Creating and format GraphQL errors.
* [`graphql/utilities`](src/utilities/README.md): Common useful computations
  upon the GraphQL language and type objects.
* [`graphql/subscription`](src/subscription/README.md): Subscribe to data
  updates.
