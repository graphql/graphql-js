## GraphQL Subscription

NOTE: the `graphql/subscription` module has been deprecated with its exported functions integrated into the `graphql/execution` module, to better conform with the terminology of the GraphQL specification. For backwards compatibility, the `graphql/subscription` module currently re-exports the moved functions from the `graphql/execution` module. In the next major release, the `graphql/subscription` module will be dropped entirely.

The `graphql/subscription` module is responsible for subscribing to updates on specific data.

```js
import { subscribe, createSourceEventStream } from 'graphql/subscription'; // ES6
var GraphQLSubscription = require('graphql/subscription'); // CommonJS
```
