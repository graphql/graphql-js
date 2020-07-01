---
title: graphql/language
layout: ../_core/GraphQLJSLayout
category: API Reference
permalink: /graphql-js/language/
sublinks: BREAK,getLocation,Kind,lex,parse,parseValue,printSource,visit
next: /graphql-js/type/
---

The `graphql/language` module is responsible for parsing and operating on the GraphQL language. You can import either from the `graphql/language` module, or from the root `graphql` module. For example:

```js
import { Source } from 'graphql'; // ES6
var { Source } = require('graphql'); // CommonJS
```

## Overview

_Source_

<ul class="apiIndex">
  <li>
    <a href="#source">
      <pre>class Source</pre>
      Represents the input string to the GraphQL server
    </a>
  </li>
  <li>
    <a href="#getlocation">
      <pre>function getLocation</pre>
      Converts a character offset to a row and column in the Source
    </a>
  </li>
</ul>

_Lexer_

<ul class="apiIndex">
  <li>
    <a href="#lex">
      <pre>function lex</pre>
      Lexes a GraphQL Source according to the GraphQL Grammar
    </a>
  </li>
</ul>

_Parser_

<ul class="apiIndex">
  <li>
    <a href="#parse">
      <pre>function parse</pre>
      Parses a GraphQL Source according to the GraphQL Grammar
    </a>
  </li>
  <li>
    <a href="#parseValue">
      <pre>function parseValue</pre>
      Parses a value according to the GraphQL Grammar
    </a>
  </li>
  <li>
    <a href="#kind">
      <pre>var Kind</pre>
      Represents the various kinds of parsed AST nodes.
    </a>
  </li>
</ul>

_Visitor_

<ul class="apiIndex">
  <li>
    <a href="#visit">
      <pre>function visit</pre>
      A general-purpose visitor to traverse a parsed GraphQL AST
    </a>
  </li>
  <li>
    <a href="#break">
      <pre>var BREAK</pre>
      A token to allow breaking out of the visitor.
    </a>
  </li>
</ul>

_Printer_

<ul class="apiIndex">
  <li>
    <a href="#print">
      <pre>function print</pre>
      Prints an AST in a standard format.
    </a>
  </li>
</ul>

## Source

### Source

```js
export class Source {
  constructor(body: string, name?: string, locationOffset?: Location)
}

type Location = {
  line: number;
  column: number;
}
```

A representation of source input to GraphQL. The `name` and `locationOffset` parameters are
optional, but they are useful for clients who store GraphQL documents in source files.
For example, if the GraphQL input starts at line 40 in a file named `Foo.graphql`, it might
be useful for `name` to be `"Foo.graphql"` and location to be `{ line: 40, column: 1 }`.
The `line` and `column` properties in `locationOffset` are 1-indexed.

### getLocation

```js
function getLocation(source: Source, position: number): SourceLocation

type SourceLocation = {
  line: number;
  column: number;
}
```

Takes a Source and a UTF-8 character offset, and returns the corresponding
line and column as a SourceLocation.

## Lexer

### lex

```js
function lex(source: Source): Lexer;

type Lexer = (resetPosition?: number) => Token;

export type Token = {
  kind: number;
  start: number;
  end: number;
  value: ?string;
};
```

Given a Source object, this returns a Lexer for that source.
A Lexer is a function that acts as a generator in that every time
it is called, it returns the next token in the Source. Assuming the
source lexes, the final Token emitted by the lexer will be of kind
EOF, after which the lexer will repeatedly return EOF tokens whenever
called.

The argument to the lexer function is optional and can be used to
rewind or fast forward the lexer to a new position in the source.

## Parser

### parse

```js
export function parse(
  source: Source | string,
  options?: ParseOptions
): Document
```

Given a GraphQL source, parses it into a Document.

Throws GraphQLError if a syntax error is encountered.

### parseValue

```js
export function parseValue(
  source: Source | string,
  options?: ParseOptions
): Value
```

Given a string containing a GraphQL value, parse the AST for that value.

Throws GraphQLError if a syntax error is encountered.

This is useful within tools that operate upon GraphQL Values directly and
in isolation of complete GraphQL documents.

### Kind

An enum that describes the different kinds of AST nodes.

## Visitor

### visit

```js
function visit(root, visitor, keyMap)
```

visit() will walk through an AST using a depth-first traversal, calling
the visitor's enter function at each node in the traversal, and calling the
leave function after visiting that node and all of its child nodes.

By returning different values from the enter and leave functions, the
behavior of the visitor can be altered, including skipping over a sub-tree of
the AST (by returning false), editing the AST by returning a value or null
to remove the value, or to stop the whole traversal by returning BREAK.

When using visit() to edit an AST, the original AST will not be modified, and
a new version of the AST with the changes applied will be returned from the
visit function.

```js
var editedAST = visit(ast, {
  enter(node, key, parent, path, ancestors) {
    // @return
    //   undefined: no action
    //   false: skip visiting this node
    //   visitor.BREAK: stop visiting altogether
    //   null: delete this node
    //   any value: replace this node with the returned value
  },
  leave(node, key, parent, path, ancestors) {
    // @return
    //   undefined: no action
    //   false: no action
    //   visitor.BREAK: stop visiting altogether
    //   null: delete this node
    //   any value: replace this node with the returned value
  },
});
```

Alternatively to providing enter() and leave() functions, a visitor can
instead provide functions named the same as the kinds of AST nodes, or
enter/leave visitors at a named key, leading to four permutations of the
visitor API:

1. Named visitors triggered when entering a node of a specific kind.

```js
visit(ast, {
  Kind(node) {
    // enter the "Kind" node
  },
});
```

2. Named visitors that trigger upon entering and leaving a node of
   a specific kind.

```js
visit(ast, {
  Kind: {
    enter(node) {
      // enter the "Kind" node
    }
    leave(node) {
      // leave the "Kind" node
    }
  }
});
```

3. Generic visitors that trigger upon entering and leaving any node.

```js
visit(ast, {
  enter(node) {
    // enter any node
  },
  leave(node) {
    // leave any node
  },
});
```

4. Parallel visitors for entering and leaving nodes of a specific kind.

```js
visit(ast, {
  enter: {
    Kind(node) {
      // enter the "Kind" node
    },
  },
  leave: {
    Kind(node) {
      // leave the "Kind" node
    },
  },
});
```

### BREAK

The sentinel `BREAK` value described in the documentation of `visitor`.

## Printer

### print

```js
function print(ast): string
```

Converts an AST into a string, using one set of reasonable
formatting rules.
