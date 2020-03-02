## GraphQL JS

The primary `graphql` module includes everything you need to define a GraphQL
schema and fulfill GraphQL requests.

```js
import { ... } from 'graphql'; // ES6
var GraphQL = require('graphql'); // CommonJS
```

Each sub directory within is a sub-module of graphql-js:

- [`graphql/language`](language/README.md): Parse and operate on the GraphQL
  language.
- [`graphql/type`](type/README.md): Define GraphQL types and schema.
- [`graphql/validation`](validation/README.md): The Validation phase of
  fulfilling a GraphQL result.
- [`graphql/execution`](execution/README.md): The Execution phase of fulfilling
  a GraphQL request.
- [`graphql/error`](error/README.md): Creating and formatting GraphQL errors.
- [`graphql/utilities`](utilities/README.md): Common useful computations upon
  the GraphQL language and type objects.
- [`graphql/subscription`](subscription/README.md): Subscribe to data updates.
