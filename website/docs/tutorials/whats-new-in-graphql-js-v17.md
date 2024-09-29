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

- Support for resolver functions returning async iterables.
- Expose `printDirective()` helper function.

## API Changes:

- Changes to input coercion:
  - Use new utility `coerceInputLiteral()` instead of `valueFromAST()`.
  - Use new utility `replaceVariableValues()` to replace variables within complex scalars uses as inputs. Internally, `replaceVariableValues()` uses new utility `valueToLiteral()` to convert from an external input value to a literal value. This allows variables embedded within complex scalars to use the correct default values.
  - Use new utility `valueToLiteral()` to convert from an external input value to a literal value. Custom scalars can define custom behavior by implementing an optional `valueToLiteral()` method.
  - Use new `parseConstLiteral()` methods on leaf types instead of `parseLiteral()` to convert literals to values, by first calling new utility `replaceVariableValues()` on the non-constant literal, and then by calling `parseConstLiteral()`.
- Changes to the `subscribe()` function:
  - `subscribe()` may now return a non-promise.
  - When a subscription root field errors, `subscribe()` now returns a well-formatted `GraphQLError` rather than throwing.
- Changes to Variable Values throughout the code base:
  - Variable Values are now a dedicated type containing both the coerced values as before as well as the variable signature and provided source, so that variables embedded within complex scalars will be able to be properly replaced. This is non-spec behavior, but was previously supported by `graphql-js` and will now be sound.
  - The return type of `getVariableValues()` has been updated, as have the provided arguments to `getArgumentValues()`, `coerceInputLiteral()`, and `collectFields()`, and `getDirectiveValues()`.
- Changes to default values:
  - The `defaultValue` property of `GraphQLArgument` and `GraphQLInputField` is now of new type `GraphQLDefaultValueUsage`. A `GraphQLDefaultValueUsage` object contains either a `literal` property, which is as AST node representing the parsed default value included within the SDL, or a `value` property, the default value as specified programmatically.
  - Introspection now returns the exact original default value included within the SDL rather than attempting to "serialize" input values, avoiding some rare cases in which default values within an introspected schema could differ slightly from the original SDL (e.g. [#3501](https://github.com/graphql/graphql-js/issues/3051)).
- Other Changes:
- `IntrospectionType` is now properly typed using `TypeKind` Enum.

## Deprecations

- `valueFromAST()` is deprecated, use `coerceInputLiteral()` instead.
- `parseLiteral()` methods of custom scalars are deprecated, use `parseConstLiteral()` instead.

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
