# Generated Execution

This folder contains the source generator for specialized GraphQL execution.
It builds on the compiler, but it is a separate execution strategy.

`generateExecution()` and `generateSubscription()` accept the same static
arguments as `compileExecution()` and `compileSubscription()`. They return an
ECMAScript module source string. That source can be written to disk and imported
like normal application code; the generator does not use `eval`, `new Function`,
or a runtime code loader.

The generated module exports:

- `createCompiledExecution(args)` for query and mutation operations;
- `createCompiledSubscription(args)` for subscription operations.

The factory accepts runtime values that cannot be serialized into source, such
as the schema instance, resolver functions, hooks, and per-process options. The
returned object has the same execution API as the compiled operation.

## Relationship To The Compiler

The generator uses the compiler as its front end:

- `compileExecutionState()` validates and selects the operation.
- compiler helpers coerce static literals and build argument plans.
- generated execution still uses `CompiledExecutor` for shared error
  collection, abort state, incremental publishing, stream queues, and
  null-bubbling state.

After that handoff, the generator diverges from the in-memory compiler. Instead
of keeping generic field collectors and queue jobs, it builds an `OperationPlan`
and emits hard-coded source for the exact operation.

The compiler is a reusable in-memory plan. The generator is an importable SDK
module specialized to one operation.

## Architecture

Generation has three layers:

1. Build static operation facts from the compiler state.
2. Convert those facts into an `OperationPlan`.
3. Emit module source from the `OperationPlan`.

The emitted module contains:

- static document parsing and static operation/fragment references;
- a factory that binds the generated code to a runtime schema;
- a minimal validated execution args builder;
- generated variable coercion helpers when possible;
- generated argument helpers;
- one binding function per selection set and concrete parent type;
- one execution function per selection set;
- one specialized field function per non-leaf field;
- inlined leaf-field code in the parent selection-set function;
- switch dispatchers for abstract possible types;
- helper functions only for completion shapes that the operation uses.

Factory-time binding checks that the runtime schema still matches the facts
used to generate source. If a field, resolver mode, scalar coercer, object
`isTypeOf` shape, root type, or possible type no longer matches, the factory
throws an incompatibility error instead of silently using generic execution.

Generated result maps use `Object.create(null)` to preserve the 17.x
null-prototype result contract and avoid prototype-name hazards.

## Optimization Paths

### Root Execution

If no root field can null the whole response, generated execution writes
directly into the response data object. If a root field can bubble null to the
root, it uses a small root box so null propagation can replace `data`.

For non-incremental operations without async hooks or external abort signals,
the generated finish path builds `{ data }` or `{ errors, data }` directly.
Incremental operations use the shared executor finish path because they must
construct publisher work.

### Field Collection

Supported generated operations do not collect ordinary fields at runtime. The
generator pre-collects the operation into a field tree per selection set and
per concrete parent type.

Fields with the same response name are merged at generation time only when
their field name, arguments, output kind, resolver mode, nullability, stream
plan, and child possible types match. Non-mergeable fields need runtime field
planning rather than static source emission.

### Resolver Binding

Each field is assigned one resolver mode:

- `default`: no schema resolver and no custom fallback field resolver. The
  generated code reads the source property directly. If it is not a function,
  no argument object or `GraphQLResolveInfo` object is created.
- `field`: the schema field has a resolver. The binder captures that exact
  resolver and generated code calls it directly.
- `customDefault`: the field has no resolver but a custom fallback
  `fieldResolver` was provided. The binder captures that fallback.

Promise-valued field results are supported. They do not disable generated
execution. The generated code increments the runner's pending count, installs
resolve/reject callbacks, and resumes that field's completion when the promise
settles. Synchronous values avoid that bookkeeping.

### `GraphQLResolveInfo`

Generated code builds `GraphQLResolveInfo` only when the current path needs it:

- explicit field resolvers;
- custom fallback field resolvers;
- default-resolved source functions;
- abstract `resolveType`;
- object `isTypeOf`;
- stream item completion;
- subscription source execution.

Plain default property reads do not allocate `info`.

The generated `info` object has hard-coded field name, field nodes, return
type, parent type, path, static fragments, static operation, variable values,
and shared helper accessors.

### Leaf Fields

Leaf fields are inlined into the parent selection-set function. The generated
code resolves the field, handles promise/null/error cases, and completes the
leaf value without a generic field job.

For built-in output scalars (`Boolean`, `Float`, `ID`, `Int`, and `String`),
the factory verifies that the runtime scalar still uses the built-in
`coerceOutputValue`. If it does, generated code uses primitive coercion
shortcuts before falling through to the full generated scalar helper. Custom
scalars and modified built-ins use the bound `coerceOutputValue` method.

### Object Fields

Concrete object fields without `isTypeOf` have the shortest object completion
path. Nullable object fields whose children cannot null the parent can create
the child data object, assign it, and call the child selection-set function
without allocating a success completion target.

Concrete object fields with `isTypeOf` are still specialized, but generated
code must call `isTypeOf`. Promise-valued `isTypeOf` results are supported by
the runner pending path.

### Abstract Fields

For interfaces and unions, generation computes every possible concrete type
and emits one child selection-set function per possible object type. Runtime
execution still calls the abstract type's `resolveType` or the configured type
resolver, validates the returned type name, and dispatches through a hard-coded
switch.

If the resolved concrete type has `isTypeOf`, generated code calls it. Promise
results from `resolveType` and `isTypeOf` are supported.

### Lists

Generated list completion is specialized by item shape:

- leaf lists use a leaf-list loop and built-in scalar shortcuts when possible;
- object lists use object-list item functions and a synchronous object-item
  path when the item is non-null, non-error, non-promise, and does not require
  `isTypeOf`;
- abstract lists resolve the runtime type per item and dispatch to generated
  concrete selection-set functions.

Arrays are the fastest list return shape because generated code can preallocate
the result array. Other synchronous iterables and async iterables are supported
with iterator cleanup and async tracking.

Promise-valued list items are supported through per-item pending work.

### Arguments

Fields with no arguments reuse a frozen empty null-prototype argument object.

Constant serializable arguments are coerced at generation time and emitted as a
frozen null-prototype object. Bare variable arguments, such as `arg: $value`,
and embedded variable arguments, such as `arg: { id: $id }`, are inlined when
the operation's variable definitions prove the needed values are always defined
or always non-null.

Argument shapes that cannot be serialized or inlined safely stay outside the
static source path rather than adding a generic argument evaluator to the hot
field path.

### Variables

Operations with no variables reuse an empty `{ sources, coerced }` pair.

When all variables are built-in scalars, generated code first tries a cheap
provided-values path that validates primitive values without constructing
detailed errors. If that path fails, it runs the general generated path so
GraphQL-compliant variable errors are produced.

Scalar and enum variables can use generated coercion plans. Complex variable
types such as lists and input objects currently use the compiled variable
coercion helper inside the generated module. They remain correct, but they are
not the fastest generated variable path.

### Inclusion Directives

Static `@skip` and `@include` values are folded at generation time. Statically
skipped selections are removed from the emitted field tree. Non-null boolean
variables can become generated condition checks. Dynamic inclusion conditions
outside those shapes need runtime selection planning.

### Defer and Stream

Static `@defer` and `@stream` are compiled into generated delivery groups and
stream handlers. Generated execution uses the shared `CompiledExecutor`,
`IncrementalPublisher`, `Queue`, and backpressure machinery.

`@stream` is supported on generated list fields when `initialCount` is static
and `if` is static or expressible as the supported variable condition. Stream
on subscription operations stays on the runtime execution path.

Nested or otherwise complex defer usage sets currently stay on the compiled
runtime incremental planner. The in-memory compiled executor supports broader
incremental shapes.

### Subscriptions

Generated subscriptions emit a specialized subscription-source function for
the selected root subscription field. That path binds the field's `subscribe`
function or subscribe field resolver, builds `GraphQLResolveInfo`, validates
the async iterable result, and maps source events through the generated event
execution path.

The generated subscription object exposes the same subscription API as the
compiled subscription object.

### Error Handling and Null Bubbling

Generated execution uses the shared collected-error and null-target model from
`CompiledExecutor`. Field errors are recorded with a path and target. The
runner applies nulled targets when pending work drains, which lets sibling work
continue while preserving final GraphQL nullability semantics.

Generated code emits specialized error paths for field resolver errors, scalar
coercion errors, object completion errors, list item errors, iterable failures,
abstract runtime type errors, subscription source failures, aborts, and
unexpected incremental delivery.

## Staying On The Fastest Generated Path

Generate once, write the source, and import it normally. Re-generating source
inside a request path defeats the point of the generator.

Keep the runtime schema shape identical to the generated assumptions. Do not
change whether a hot field has a resolver, whether an object type has
`isTypeOf`, whether a built-in scalar has its built-in coercer, or whether an
abstract type's possible types exist.

Use plain object properties for default-resolved hot fields. Source methods are
correct but need arguments and `GraphQLResolveInfo`.

Return synchronous values when practical. Promises are supported and localized,
but they add pending bookkeeping and microtask work.

Return arrays for list fields when practical. Generic iterables and async
iterables are correct but slower.

Avoid `isTypeOf` on concrete object types unless the schema needs it. It forces
extra completion work.

Keep built-in scalar implementations unmodified to use primitive scalar
shortcuts. Custom scalars are correct but call their coercer.

Use static directive values or non-null boolean variables for hot `@skip`,
`@include`, `@defer`, and `@stream` paths.

Prefer built-in scalar, scalar, or enum variables on hot generated operations.
Complex variable input types currently use the compiled variable coercion
helper.

Avoid fragment arguments and fragment variable definitions in generated hot
operations for now. The compiler supports more of that generic machinery than
the source generator.

## Dynamic Boundaries

The generator returns GraphQL errors instead of source when a static source file
would need runtime planning decisions. These are dynamic boundaries, not
invalid execution semantics. Known static-generation boundaries include:

- no root type for the operation;
- requesting subscription generation for a non-subscription operation;
- fragment spreads with arguments;
- fragment definitions with variable definitions;
- dynamic inclusion directives that cannot be reduced to static values or
  non-null variable checks;
- dynamic `@defer` arguments;
- nested or complex defer usage sets;
- dynamic `@stream` arguments outside the supported static/variable shape;
- `@stream` on subscription operations;
- `@stream` on non-list fields;
- argument coercion shapes that cannot be serialized or inlined safely;
- non-mergeable fields with the same response name.

For these shapes, use `compileExecution()` or regular execution so those
runtime decisions happen in the executor that already handles them.
