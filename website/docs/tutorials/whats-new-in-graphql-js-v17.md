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

#### Default Values

- Use external GraphQL values for the programmatic `defaultValue` property of `GraphQLArgument` and `GraphQLInputField` objects rather than coerced internal default value. Introspection will then present the exact original default value rather than attempting to "uncoerce" internal input values, avoiding some rare cases in which default values within an introspected schema could differ slightly from the original SDL (e.g. [#3501](https://github.com/graphql/graphql-js/issues/3051)).

## New API features

- New support for resolver functions returning async iterables.
- New `validateExecutionArgs()`, `executeQueryOrMutationOrSubscriptionEvent()`, or `experimentalExecuteQueryOrMutationOrSubscriptionEvent()` helpers are available to perform GraphQL argument evaluation and/or manipulation and then manually continue with execution.
- New `perEventExecutor` option allows specification of a custom executor for subscription source stream events, with the default option set to new helper `executeSubscriptionEvent()`.
- New `abortSignal` option to `graphql()`, `execute()`, and `subscribe()` allows cancellation of these methods; the `abortSignal` can also be passed to field resolvers to cancel asynchronous work that they initiate.
- New `hideSuggestions` option added to `graphql()`, `validate()`, `execute()`, and `subscribe()`; the `getVariableValues()`, `getArgumentValues()`, `getDirectiveValues()`, `coerceInputValue()`, `coerceInputLiteral()`, `collectFields()` helpers; the `ValidationContext` class, as well as the coercion methods for leaf types. The option hides suggestions!
- New utility `findSchemaChanges()` can be used to find safe changes as well as the breaking and dangerous changes returned by `findBreakingChanges()` and `findDangerousChanges()`. The latter two functions are now deprecated.
- New utility `coerceInputLiteral()` replaces `valueFromAST()`.
- New utility `valueToLiteral()` converts from an external input value to a literal value. Custom scalars can define custom behavior by implementing an optional new `valueToLiteral()` method, otherwise a default conversion function will be used.
- New utilities `validateInputValue()` and `validateInputLiteral()` can be used to validate input values and literals, respectively.
- New utility `replaceVariableValues()` can be used to replace variables within complex scalars uses as inputs. This allows variables embedded within complex scalars to use the correct default values.
- New `coerceInputLiteral()` methods on custom scalar types can be used (along with the new `valueToLiteral()` method when required) to automatically convert literals to values, including any variables embedded within complex scalars. Embedded variables will (finally) receive the appropriate default values! The `parseLiteral()` methods have been deprecated.
- New helper `printDirective()` function introduced.
- New option to use symbols rather than strings as keys within `extensions` properties of the various GraphQL Schema elements.

## API Changes:

- Changes to the `execute()` function:
  - Field resolvers that are still running after the function returns (e.g. when null-bubbling from a rejected asynchronous resolver leads to early return with additional still running asynchronous resolvers) will no longer trigger additional child resolvers.
- Changes to the `subscribe()` function:
  - `subscribe()` may now return a non-promise.
  - When a subscription root field errors, `subscribe()` now returns a well-formatted `GraphQLError` rather than throwing.
- Changes to the `coerceInputValue()` helper:
  - On coercion failure, the function now will return early with `undefined` rather than collecting or throwing errors. If detailed error information is desired, use new utility `validateInputValue()`.
- Changes to Variable Values throughout the code base:
  - Variable Values are now a dedicated type containing both the coerced values as before as well as the variable signature and provided source, so that variables embedded within complex scalars will be able to be properly replaced.
  - The return type of `getVariableValues()` has been updated, as have the provided arguments to `getArgumentValues()`, `coerceInputLiteral()`, and `collectFields()`, and `getDirectiveValues()`.
- Changes to AST nodes:
  - AST node properties have been optimized to use `undefined` rather than empty arrays.
- Enum Changes:
  - `IntrospectionType` is now properly typed using `TypeKind` Enum.
  - The `Kind` enum has been changes from a TypeScript Enum to an object literal. A `Kind` type is still exported, such that `typeof Kind` is not the same as the `Kind` type.
- Change to `GraphQLSchema` configuration:
  - The `assumeValid` config property exported by the `GraphQLSchema.toConfig()` method now passes through the original flag passed on creation of the `GraphQLSchema`. Previously, the `assumeValid` property would be to `true` if validation had been run, potentially concealing the original intent.

## Deprecations

- `valueFromAST()` is deprecated, use `coerceInputLiteral()` instead.
- `parse()` methods of leaf types are deprecated, use `coerceInputValue()` instead.
- `parseLiteral()` methods of leaf types are deprecated, use `coerceInputLiteral()` instead.
- `serialize()` methods of leaf types are deprecated, use `coerceOutputValue()` instead.
- `findBreakingChanges()` and `findDangerousChanges()` are deprecated, use `findSchemaChanges()` instead.

## Removals

- Deprecated `graphql/subscription` module has been removed, use `graphql/execution` instead
- Deprecated `getOperationRootType()` #3571 has been removed, use `schema.getRootType()` instead.
- Deprecated `assertValidName()` and `isValidNameError()` has been removed, use `assertName()` instead.
- Deprecated custom `TypeInfo` argument for `validate()` has been removed.
- Deprecated custom `getFieldDefFn()` argument for `TypeInfo` constructor has been removed. To customize field resolution, one can subclass the `GraphQLSchema` class and override the `getField()` method.
- Deprecated positional arguments for the `GraphQLError` constructor have been removed.
- Deprecated distinct Enum types `KindEnum`, `TokenKindEnum`, and `DirectiveLocationEnum` have been removed.
- Deprecated `getVisitFn()` helper function has been removed, use `getEnterLeaveForKind()` instead.
- Deprecated `formatError()` and `printError()` helper functions have been removed, use `error.toString()` and `error.toJSON()` methods instead.
- Deprecated positional arguments for `createSourceEventStream()` have been removed.
