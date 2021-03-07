---
title: graphql/utilities
layout: ../_core/GraphQLJSLayout
category: API Reference
permalink: /graphql-js/utilities/
sublinks: astFromValue,buildASTSchema,buildClientSchema,buildSchema,doTypesOverlap,findBreakingChanges,findDangerousChanges,introspectionFromSchema,introspectionQuery,isEqualType,isTypeSubTypeOf,isValidJSValue,isValidLiteralValue,lexicographicSortSchema,printIntrospectionSchema,printSchema,separateOperations,typeFromAST,TypeInfo
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
  <li>
    <a href="#introspectionfromschema">
      <pre>function introspectionFromSchema</pre>
      Produces an introspection query for a given schema. (Inverse of [`buildClientSchema`](#buildclientschema))
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
  <li>
    <a href="#lexicographicsortschema">
      <pre>function lexicographicSortSchema</pre>
      Creates a copy of a given schema where all types are sorted.
    </a>
  </li>
  <li>
    <a href="#separateoperations">
      <pre>function separateOperations</pre>
      Creates an object of Documents by operation name from a single AST document.
    </a>
  </li>
</ul>

_Schema Validation_

<ul class="apiIndex">
  <li>
    <a href="#findbreakingchanges">
      <pre>function findBreakingChanges</pre>
      Given two schemas, returns an Array containing descriptions of all the types of breaking changes.
    </a>
  </li>
  <li>
    <a href="#finddangerouschanges">
      <pre>function findDangerousChanges</pre>
      Given two schemas, returns an Array containing descriptions of all the types of dangerous changes.
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

_Type Validation_

<ul class="apiIndex">
  <li>
    <a href="#isequaltype">
      <pre>function isEqualType</pre>
      Provided two types, return true if the types are equal (invariant)
    </a>
  </li>
  <li>
    <a href="#istypesubtypeof">
      <pre>function isTypeSubTypeOf</pre>
      Provided a type and a super type, return true if the first type is either equal or a subset of the second super type
    </a>
  </li>
  <li>
    <a href="#dotypesoverlap">
      <pre>function doTypesOverlap</pre>
      Provided two composite types, determine if they "overlap".
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

### introspectionFromSchema

```js
introspectionFromSchema(
  schema: GraphQLSchema,
  options: ?IntrospectionOptions,
): IntrospectionQuery
```

Given a schema and optionally further IntrospectionOptions, creates and returns an IntrospectionQuery that reproduces the type system of that schema.

IntrospectionQuery is useful for utilities that care about type and field relationships, but do not need to traverse through those relationships.

This is the inverse of [`buildClientSchema`](#buildclientschema). The primary use case is outside of the server context, for instance when doing schema comparisons.

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

### lexicographicSortSchema

```js
function lexicographicSortSchema(
  schema: GraphQLSchema,
): GraphQLSchema
```

Creates a copy of the given schema where all types are lexicographical sorted.
This function does not modify the original schema!

### separateOperations

```js
function separateOperations(
  documentAST: Document,
): {[operationName: string]: Document}
```

Given an AST document with potentially many operations and fragments, it produces a collection of AST documents each of which contains a single operation as well the fragment definitions it refers to.

## Schema Validation

### findBreakingChanges

```js
function findBreakingChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange>
```

Given two schemas, returns an Array containing descriptions of all the types of breaking changes.

The different types of breaking changes are exported as `BreakingChangeType`.

### findDangerousChanges

```js
function findDangerousChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange>
```

Given two schemas, returns an Array containing descriptions of all the types of potentially dangerous changes covered by the other functions down below.

The different types of dangerous changes are exported as `DangerousChangeType`.

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

## Type Validation

### isEqualType

```js
function isEqualType(
  typeA: GraphQLType,
  typeB: GraphQLType
): boolean
```

Provided two types, return true if the types are equal (invariant).

### isTypeSubTypeOf

```js
function isTypeSubTypeOf(
  schema: GraphQLSchema,
  maybeSubType: GraphQLType,
  superType: GraphQLType,
): boolean
```

Provided a type and a super type, return true if the first type is either equal or a subset of the second super type (covariant).

### doTypesOverlap

```js
function doTypesOverlap(
  schema: GraphQLSchema,
  typeA: GraphQLCompositeType,
  typeB: GraphQLCompositeType,
): boolean
```

Provided two composite types, determine if they "overlap". Two composite types overlap when the Sets of possible concrete types for each intersect.

This is often used to determine if a fragment of a given type could possibly be visited in a context of another type.

This function is commutative.

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
