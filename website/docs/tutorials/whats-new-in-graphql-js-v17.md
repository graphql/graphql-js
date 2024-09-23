# What's New in `graphql-js` v17?

## Changes by Way of the Specification

### New Experimental Features

#### Experimental Support for Incremental Delivery

- [Spec PR](https://github.com/graphql/graphql-spec/pull/1110) / [RFC](https://github.com/graphql/graphql-wg/blob/main/rfcs/DeferStream.md)
- enabled only when using `experimentalExecuteIncrementally()`, use of a schema or operation with `@defer`/`@stream` directives within `execute()` will now throw.
- enable early execution with the new `enableEarlyExecution` configuration option for `experimentalExecuteIncrementally()`.

#### Experimental Support for Fragment Arguments

- [Spec PR](https://github.com/graphql/graphql-spec/pull/1081) / [RFC](https://github.com/graphql/graphql-wg/blob/main/rfcs/DeferStream.md)
- enable with the new `experimentalFragmentArguments` configuration option for `parse()`.
- new experimental `Kind.FRAGMENT_ARGUMENT` for visiting
- new experimental `TypeInfo` methods and options for handling fragment arguments.
- coerce AST via new function `coerceInputLiteral()` with experimental fragment variables argument (as opposed to deprecated `valueFromAST()` function).

### Specification Clarifications

#### Fix ambiguity around when schema definition may be omitted

- [Spec PR](https://github.com/graphql/graphql-spec/pull/987)
- Schema definition will include only the proper root types.

### Implementation Fixes

#### Enforcing uniqueness of root types

- `graphql-js` now properly enforces that the schema's root types must be unique.

## New API features

- Use `coerceInputLiteral()` instead of `valueFromAST()`.
- Support for resolver functions returning async iterables.
- Expose `printDirective()` helper function.

## API Changes:

- Changes to the `subscribe()` function:
  - `subscribe()` may now return a non-promise.
  - When a subscription root field errors, `subscribe()` now returns a well-formatted `GraphQLError` rather than throwing.
- Properly type `IntrospectionType` using `TypeKind` Enum.

## Deprecations

- `valueFromAST()` is deprecated, use `coerceInputLiteral()` instead.

## Removals

- Removed deprecated `graphql/subscription` module, use `graphql/execution` instead
- Removed deprecated `getOperationRootType()` #3571, use `schema.getRootType()` instead.
- Remove deprecated `assertValidName()` and `isValidNameError()`, use `assertName()` instead.
- Removed deprecated custom `TypeInfo` argument for `validate()`.
- Remove deprecated custom `getFieldDefFn()` argument for `TypeInfo` constructor. To customize field resolution, one can subclass the `GraphQLSchema` class and override the `getField()` method.
- Remove deprecated positional arguments for the `GraphQLError` constructor.
- Remove deprecated distinct Enum types: `KindEnum`, `TokenKindEnum`, and `DirectiveLocationEnum`.
- Remove deprecated `getVisitFn()` helper function, use `getEnterLeaveForKind()` instead.
- Remove deprecated `formatError()` and `printError()` helper functions, use `error.toString()` and `error.toJSON()` methods instead.
- Remove deprecated positional arguments for `createSourceEventStream()`.
