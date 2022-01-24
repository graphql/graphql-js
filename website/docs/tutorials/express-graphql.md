---
title: express-graphql
---

The `express-graphql` module provides a simple way to create an [Express](https://expressjs.com/) server that runs a GraphQL API.

```js
import { graphqlHTTP } from 'express-graphql'; // ES6
var { graphqlHTTP } = require('express-graphql'); // CommonJS
```

### graphqlHTTP

```js
graphqlHTTP({
  schema: GraphQLSchema,
  graphiql?: ?boolean,
  rootValue?: ?any,
  context?: ?any,
  pretty?: ?boolean,
  formatError?: ?Function,
  validationRules?: ?Array<any>,
}): Middleware
```

Constructs an Express application based on a GraphQL schema.

See the [express-graphql tutorial](./running-an-express-graphql-server.md) for sample usage.

See the [GitHub README](https://github.com/graphql/express-graphql) for more extensive documentation of the details of this method.
