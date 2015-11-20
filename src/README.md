GraphQL JS
----------

The primary `graphql` module includes everything you need to define a GraphQL
schema and fulfill GraphQL requests.

```js
import { ... } from 'graphql'; // ES6
var GraphQL = require('graphql'); // CommonJS
```

Each sub directory within is a sub-module of graphql-js:

* `graphql/language`: Parse and operate on the GraphQL language.
* `graphql/type`: Define GraphQL types and schema.
* `graphql/validation`: The Validation phase of fulfilling a GraphQL result.
* `graphql/execution`: The Execution phase of fulfilling a GraphQL request.
* `graphql/error`: Creating and format GraphQL errors.
* `graphql/utilities`: Common useful computations upon the GraphQL language and
  type objects.
