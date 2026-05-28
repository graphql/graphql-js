# Compiled Execution

This folder contains the in-memory operation compiler. It turns a static
operation into reusable execution machinery.

The compiled executor is optimized for repeated execution of the same operation
against the same schema shape. It preserves the GraphQL.js execution semantics,
including null bubbling, error paths, incremental delivery, subscriptions,
abort handling, hooks, and null-prototype result objects.

## Architecture

Compilation starts with `compileExecutionState()`. That shared stage validates
and stores the static operation state: schema, document,
operation, fragments, options, root values supplied at compile time, and the
field collector.

`compileExecution()` and `compileSubscription()` wrap that state in reusable
operation objects. Each operation exposes the same runtime entrypoints as normal
execution:

- `execute()`
- `experimentalExecuteIncrementally()`
- `executeIgnoringIncremental()`
- subscription-only `subscribe()`, `createSourceEventStream()`,
  `mapSourceToResponseEvent()`, and `executeSubscriptionEvent()`

Runtime execution uses `CompiledExecutor`. The executor owns error collection,
null bubbling, abort state, incremental work, stream queues, and shared
execution context. It uses a queue runner for field sets, field resolution, and
completion work, so asynchronous sibling work can continue while errors and
nulls are applied at the correct boundary.

## Compilation Stages

### Variables

`compileVariableValues()` turns each variable definition into a compiled entry:
signature, default value, default error if any, and a compiled input coercer.

`compileInputValue()` recursively builds coercers for non-null, list, input
object, scalar, and enum inputs. Recursive input object types use a temporary
lazy coercer while the final coercer is being built.

`CompiledExecutionImpl` caches variable coercion results by raw
`variableValues` object identity and `maxCoercionErrors`. Reusing the same
variables object across calls can avoid repeated coercion work.

### Input Literals and Arguments

`compileInputLiteral()` precompiles argument literals. Static literals are
coerced once when possible. Literals containing variables become small coercer
functions that read the already-coerced runtime variables.

`compileArgumentValues()` classifies every field argument into one of these
forms:

- constant value;
- bare variable value;
- embedded variable value;
- invalid literal value;
- missing required argument;
- invalid default value.

Bare variable values are arguments whose AST value is exactly a variable, such
as `field(arg: $value)`. At execution time the compiled argument reader can
mostly copy from the already-coerced operation variable map while applying the
argument's own default and nullability rules.

Embedded variable values are argument literals where variables appear inside a
larger literal, such as `field(filter: { id: $id, tags: ["a", $tag] })`. The
compiler stores a coercer for the whole literal so execution can evaluate that
literal against the current variable values and preserve GraphQL's input
coercion semantics.

Invalid literal values are static literals that could not be coerced during
compilation. They stay distinct from embedded variables so execution can report
the same GraphQL input validation error shape when that path is exercised.

If all arguments for a field are constant, the compiled plan keeps a reusable
null-prototype argument map.

### Field Collection

`compileCollectFields()` precompiles the operation selection tree. It stores
compiled selections, fragment conditions, inclusion directives, defer
directives, stream directives, and per-field compilation caches.

Root field collection still runs per execution because variable values can
affect inclusion and incremental directives. The expensive structural work is
compiled ahead of time.

Subfield collection is memoized with the runtime variable values object,
concrete return type, and field details list. Repeated completion of the same
selection set and concrete type can reuse the grouped subfields.

### Field Execution Plans

`compileFieldExecutionPlan()` records return-type facts and selects a resolver
path:

- schema field resolver;
- custom fallback field resolver;
- default field resolver.

For default-resolved fields, plain source properties are the cheapest path:
when the source property is not a function, the compiled resolver returns the
property without building arguments or `GraphQLResolveInfo`. Source methods are
supported, but they require arguments and `info` because GraphQL's default
resolver calls them as functions.

### Completion

`CompiledExecutor` specializes several common completion paths:

- leaf fields resolve and complete directly without enqueuing a generic field
  job when the field plan already knows the leaf type;
- concrete object fields without `isTypeOf` can skip the generic complete job;
- leaf-list items use a dedicated item loop;
- arrays avoid iterator protocol overhead for list completion;
- errors are collected with null targets and applied once pending work drains.

The compiled executor still uses shared completion methods for the full
GraphQL result coercion algorithm.

### Incremental Delivery

The compiled executor uses the same runtime machinery as normal incremental
execution:

- `buildExecutionPlan()` for deferred grouped field sets;
- `Computation` for deferred execution work;
- `IncrementalPublisher` for initial/subsequent result publishing;
- `Queue` and `WorkQueue` for stream backpressure;
- `AsyncWorkTracker` and shared execution context for resolver cleanup.

`executeIgnoringIncremental()` runs the operation while ignoring incremental
payload boundaries. `execute()` throws if the operation would unexpectedly
produce multiple payloads. `experimentalExecuteIncrementally()` enables
incremental delivery.

### Subscriptions

Compiled subscriptions reuse compiled variable and field machinery. The source
event stream path compiles the root subscription field, builds `info`, calls
the field's `subscribe` resolver or subscribe field resolver, validates that
the result is an async iterable, and maps each event through compiled execution.

## Fast-Path Guidance

Compile once and reuse the returned operation object. The compile step is where
operation validation, selection compilation, variable compilation, and field
plan setup happen.

Keep the schema shape stable. The compiler stores field definitions, type
objects, and resolver choices from the schema it compiled against.

Use plain source object properties for default-resolved hot fields. A plain
property can skip argument and `GraphQLResolveInfo` allocation. A source method
is correct but slower because it must be called like a resolver.

Return synchronous values when possible. Promises are fully supported, but they
add runner pending bookkeeping and a microtask boundary.

Return arrays for list fields when possible. Arrays take the shortest compiled
list path. Other iterables and async iterables are correct but require iterator
handling and cleanup.

Avoid `isTypeOf` on concrete object types unless the schema needs it. Concrete
object fields without `isTypeOf` take a shorter completion path.

Prefer stable `variableValues` object identity when repeatedly executing the
same variable set. The compiled operation can reuse the cached coercion result
for that object and error limit.

Use static or simple variable-backed directives for hot operations. The compiler
supports dynamic directive evaluation, but static facts let more work happen
during compilation.

Keep custom scalar coercion fast. The compiled executor calls each leaf type's
`coerceOutputValue` for output completion, so scalar implementations are part
of the hot path.
