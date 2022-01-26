---
title: graphql
layout: ../_core/GraphQLJSLayout
category: API Reference
permalink: /graphql-js/graphql/
sublinks: graphql
next: /graphql-js/error/
---

The `graphql` module exports a core subset of GraphQL functionality for creation
of GraphQL type systems and servers.

```js
import { graphql } from 'graphql'; // ES6
var { graphql } = require('graphql'); // CommonJS
```

## Overview

_Entry Point_

<ul class="apiIndex">
  <li>
    <a href="#graphql">
      <pre>function graphql</pre>
      Lexes, parses, validates, and executes a GraphQL request on a schema.
    </a>
  </li>
</ul>

_Schema_

<ul class="apiIndex">
  <li>
    <a href="../type/#graphqlschema">
      <pre>class GraphQLSchema</pre>
      A representation of the capabilities of a GraphQL Server.
    </a>
  </li>
</ul>

_Type Definitions_

<ul class="apiIndex">
  <li>
    <a href="../type/#graphqlscalartype">
      <pre>class GraphQLScalarType</pre>
      A scalar type within GraphQL.
    </a>
  </li>
  <li>
    <a href="../type/#graphqlobjecttype">
      <pre>class GraphQLObjectType</pre>
      An object type within GraphQL that contains fields.
    </a>
  </li>
  <li>
    <a href="../type/#graphqlinterfacetype">
      <pre>class GraphQLInterfaceType</pre>
      An interface type within GraphQL that defines fields implementations will contain.
    </a>
  </li>
  <li>
    <a href="../type/#graphqluniontype">
      <pre>class GraphQLUnionType</pre>
      A union type within GraphQL that defines a list of implementations.
    </a>
  </li>
  <li>
    <a href="../type/#graphqlenumtype">
      <pre>class GraphQLEnumType</pre>
      An enum type within GraphQL that defines a list of valid values.
    </a>
  </li>
  <li>
    <a href="../type/#graphqlinputobjecttype">
      <pre>class GraphQLInputObjectType</pre>
      An input object type within GraphQL that represents structured inputs.
    </a>
  </li>
  <li>
    <a href="../type/#graphqllist">
      <pre>class GraphQLList</pre>
      A type wrapper around other types that represents a list of those types.
    </a>
  </li>
  <li>
    <a href="../type/#graphqlnonnull">
      <pre>class GraphQLNonNull</pre>
      A type wrapper around other types that represents a non-null version of those types.
    </a>
  </li>
</ul>

_Scalars_

<ul class="apiIndex">
  <li>
    <a href="../type/#graphqlint">
      <pre>var GraphQLInt</pre>
      A scalar type representing integers.
    </a>
  </li>
  <li>
    <a href="../type/#graphqlfloat">
      <pre>var GraphQLFloat</pre>
      A scalar type representing floats.
    </a>
  </li>
  <li>
    <a href="../type/#graphqlstring">
      <pre>var GraphQLString</pre>
      A scalar type representing strings.
    </a>
  </li>
  <li>
    <a href="../type/#graphqlboolean">
      <pre>var GraphQLBoolean</pre>
      A scalar type representing booleans.
    </a>
  </li>
  <li>
    <a href="../type/#graphqlid">
      <pre>var GraphQLID</pre>
      A scalar type representing IDs.
    </a>
  </li>
</ul>

_Errors_

<ul class="apiIndex">
  <li>
    <a href="../error/#formaterror">
      <pre>function formatError</pre>
      Format an error according to the rules described by the Response Format.
    </a>
  </li>
</ul>

## Entry Point

### graphql

```js
graphql(
  schema: GraphQLSchema,
  requestString: string,
  rootValue?: ?any,
  contextValue?: ?any,
  variableValues?: ?{[key: string]: any},
  operationName?: ?string
): Promise<GraphQLResult>
```

The `graphql` function lexes, parses, validates and executes a GraphQL request.
It requires a `schema` and a `requestString`. Optional arguments include a
`rootValue`, which will get passed as the root value to the executor, a `contextValue`,
which will get passed to all resolve functions,
`variableValues`, which will get passed to the executor to provide values for
any variables in `requestString`, and `operationName`, which allows the caller
to specify which operation in `requestString` will be run, in cases where
`requestString` contains multiple top-level operations.

## Schema

See the [Type System API Reference](../type#schema).

## Type Definitions

See the [Type System API Reference](../type#definitions).

## Scalars

See the [Type System API Reference](../type#scalars).

## Errors

See the [Errors API Reference](../error)
