---
title: Enabling Defer & Stream
sidebar_label: Enabling Defer & Stream
---

The `@defer` and `@stream` directives are not enabled by default. In order to use these directives, you must add them to your GraphQL Schema.

```js
import {
  GraphQLSchema,
  GraphQLDeferDirective,
  GraphQLStreamDirective,
  specifiedDirectives,
} from 'graphql';

const schema = new GraphQLSchema({
  query,
  directives: [
    ...specifiedDirectives,
    GraphQLDeferDirective,
    GraphQLStreamDirective,
  ],
});
```

If the `directives` option is passed to `GraphQLSchema`, the default directives will not be included. `specifiedDirectives` must be passed to ensure all standard directives are added in addition to `defer` & `stream`.
