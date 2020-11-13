---
title: graphql/utilities
layout: ../_core/GraphQLJSLayout
category: API Reference
permalink: /graphql-js/utilities/
sublinks: astFromValue,buildASTSchema,buildClientSchema,buildSchema,introspectionQuery,isValidJSValue,isValidLiteralValue,printIntrospectionSchema,printSchema,typeFromAST,TypeInfo
next: /graphql-js/validation/
---

The `graphql/utilities` module contains common useful computations to use with
the GraphQL language and type objects. You can import either from the `graphql/utilities` module, or from the root `graphql` module. For example:

```js
import { introspectionQuery } from 'graphql'; // ES6
var { introspectionQuery } = require('graphql'); // CommonJS
```

## Overview

_Introspection_

<ul class="apiIndex">
  <li>
    <a href="#getintrospectionquery">
      <pre>function getIntrospectionQuery</pre>
      Builds a GraphQL introspection query containing enough information to reproduce a type system.
    </a>
  </li>
  <li>
    <a href="#buildclientschema">
      <pre>function buildClientSchema</pre>
      Produces a client schema given the result of querying a schema with `introspectionQuery`.
    </a>
  </li>
</ul>

_Schema Language_

<ul class="apiIndex">
  <li>
    <a href="#buildschema">
      <pre>function buildSchema</pre>
      Builds a Schema object from GraphQL schema language.
    </a>
  </li>
  <li>
    <a href="#printschema">
      <pre>function printSchema</pre>
      Prints the schema in a standard format.
    </a>
  </li>
  <li>
    <a href="#printintrospectionschema">
      <pre>function printIntrospectionSchema</pre>
      Prints the introspection features of the schema in a standard format.
    </a>
  </li>
  <li>
    <a href="#buildastschema">
      <pre>function buildASTSchema</pre>
      Builds a schema from a parsed AST Schema.
    </a>
  </li>
  <li>
    <a href="#typefromast">
      <pre>function typeFromAST</pre>
      Looks up a type referenced in an AST in the GraphQLSchema.
    </a>
  </li>
  <li>
    <a href="#astfromvalue">
      <pre>function astFromValue</pre>
      Produces a GraphQL Input Value AST given a JavaScript value.
    </a>
  </li>
</ul>

_Visitors_

<ul class="apiIndex">
  <li>
    <a href="#typeinfo">
      <pre>class TypeInfo</pre>
      Tracks type and field definitions during a visitor AST traversal..
    </a>
  </li>
</ul>

_Value Validation_

<ul class="apiIndex">
  <li>
    <a href="#isvalidjsvalue">
      <pre>function isValidJSValue</pre>
      Determines if a JavaScript value is valid for a GraphQL type.
    </a>
  </li>
  <li>
    <a href="#isvalidliteralvalue">
      <pre>function isValidLiteralValue</pre>
      Determines if a literal value from an AST is valid for a GraphQL type.
    </a>
  </li>
</ul>

## Introspection

### getIntrospectionQuery

```js
interface IntrospectionOptions {
  // Whether to include descriptions in the introspection result.
  // Default: true
  descriptions?: boolean;

  // Whether to include `specifiedByUrl` in the introspection result.
  // Default: false
  specifiedByUrl?: boolean;

  // Whether to include `isRepeatable` flag on directives.
  // Default: false
  directiveIsRepeatable?: boolean;

  // Whether to include `description` field on schema.
  // Default: false
  schemaDescription?: boolean;
}

function getIntrospectionQuery(
  options: IntrospectionOptions
): string;
```

Build a GraphQL query that queries a server's introspection system for enough
information to reproduce that server's type system.

### buildClientSchema

```js
function buildClientSchema(
  introspection: IntrospectionQuery
): GraphQLSchema
```

Build a GraphQLSchema for use by client tools.

Given the result of a client running the introspection query, creates and
returns a GraphQLSchema instance which can be then used with all GraphQL.js
tools, but cannot be used to execute a query, as introspection does not
represent the "resolver", "parse" or "serialize" functions or any other
server-internal mechanisms.

## Schema Representation

### buildSchema

```js
function buildSchema(source: string | Source): GraphQLSchema {
```

Creates a GraphQLSchema object from GraphQL schema language. The schema will use default resolvers. For more detail on the GraphQL schema language, see the [schema language docs](/learn/schema/) or this [schema language cheat sheet](https://wehavefaces.net/graphql-shorthand-notation-cheatsheet-17cd715861b6#.9oztv0a7n).

### printSchema

```js
function printSchema(schema: GraphQLSchema): string {
```

Prints the provided schema in the Schema Language format.

### printIntrospectionSchema

```js
function printIntrospectionSchema(schema: GraphQLSchema): string {
```

Prints the built-in introspection schema in the Schema Language format.

### buildASTSchema

```js
function buildASTSchema(
  ast: SchemaDocument,
  queryTypeName: string,
  mutationTypeName: ?string
): GraphQLSchema
```

This takes the ast of a schema document produced by `parse` in
`graphql/language` and constructs a GraphQLSchema instance which can be
then used with all GraphQL.js tools, but cannot be used to execute a query, as
introspection does not represent the "resolver", "parse" or "serialize"
functions or any other server-internal mechanisms.

### typeFromAST

```js
function typeFromAST(
  schema: GraphQLSchema,
  inputTypeAST: Type
): ?GraphQLType
```

Given the name of a Type as it appears in a GraphQL AST and a Schema, return the
corresponding GraphQLType from that schema.

### astFromValue

```js
function astFromValue(
  value: any,
  type?: ?GraphQLType
): ?Value
```

Produces a GraphQL Input Value AST given a JavaScript value.

Optionally, a GraphQL type may be provided, which will be used to
disambiguate between value primitives.

## Visitors

### TypeInfo

```js
class TypeInfo {
  constructor(schema: GraphQLSchema)
  getType(): ?GraphQLOutputType {
  getParentType(): ?GraphQLCompositeType {
  getInputType(): ?GraphQLInputType {
  getFieldDef(): ?GraphQLFieldDefinition {
  getDirective(): ?GraphQLDirective {
  getArgument(): ?GraphQLArgument {
}
```

TypeInfo is a utility class which, given a GraphQL schema, can keep track
of the current field and type definitions at any point in a GraphQL document
AST during a recursive descent by calling `enter(node)` and `leave(node)`.

## Value Validation

### isValidJSValue

```js
function isValidJSValue(value: any, type: GraphQLInputType): string[]
```

Given a JavaScript value and a GraphQL type, determine if the value will be
accepted for that type. This is primarily useful for validating the
runtime values of query variables.

### isValidLiteralValue

```js
function isValidLiteralValue(
  type: GraphQLInputType,
  valueAST: Value
): string[]
```

Utility for validators which determines if a value literal AST is valid given
an input type.

Note that this only validates literal values, variables are assumed to
provide values of the correct type.
