---
title: Enabling Defer & Stream
sidebar_label: Enabling Defer & Stream
---

The `@defer` and `@stream` directives are not enabled by default. In order to use these directives, you must add them to your GraphQL Schema and use the `experimentalExecuteIncrementally` function instead of `execute`.

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

const result = experimentalExecuteIncrementally({
  schema,
  document,
});
```

If the `directives` option is passed to `GraphQLSchema`, the default directives will not be included. `specifiedDirectives` must be passed to ensure all standard directives are added in addition to `defer` & `stream`.

When using TypeScript, remember to set the `TMaybeIncremental` generic parameter of `execute` to `true`:

```ts
const result = execute<true>({
  schema,
  document,
});
```
