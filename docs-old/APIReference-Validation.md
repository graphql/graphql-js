---
title: graphql/validation
layout: ../_core/GraphQLJSLayout
category: API Reference
permalink: /graphql-js/validation/
sublinks: specifiedRules,validate
---

The `graphql/validation` module fulfills the Validation phase of fulfilling a
GraphQL result. You can import either from the `graphql/validation` module, or from the root `graphql` module. For example:

```js
import { validate } from 'graphql/validation'; // ES6
var { validate } = require('graphql/validation'); // CommonJS
```

## Overview

<ul class="apiIndex">
  <li>
    <a href="#validate">
      <pre>function validate</pre>
      Validates an AST against a provided Schema.
    </a>
  </li>
  <li>
    <a href="#specifiedrules">
      <pre>var specifiedRules</pre>
      A list of standard validation rules described in the GraphQL specification.
    </a>
  </li>
</ul>

## Validation

### validate

```js
function validate(
  schema: GraphQLSchema,
  ast: Document,
  rules?: Array<any>
): Array<GraphQLError>
```

Implements the "Validation" section of the spec.

Validation runs synchronously, returning an array of encountered errors, or
an empty array if no errors were encountered and the document is valid.

A list of specific validation rules may be provided. If not provided, the
default list of rules defined by the GraphQL specification will be used.

Each validation rules is a function which returns a visitor
(see the language/visitor API). Visitor methods are expected to return
GraphQLErrors, or Arrays of GraphQLErrors when invalid.

Visitors can also supply `visitSpreadFragments: true` which will alter the
behavior of the visitor to skip over top level defined fragments, and instead
visit those fragments at every point a spread is encountered.

### specifiedRules

```js
var specifiedRules: Array<(context: ValidationContext): any>
```

This set includes all validation rules defined by the GraphQL spec
