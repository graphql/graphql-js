## GraphQL Validation

The `graphql/validation` module fulfills the Validation phase of fulfilling a
GraphQL result.

```js
import { validate } from 'graphql/validation'; // ES6
var GraphQLValidator = require('graphql/validation'); // CommonJS
```

### Strict and legacy variable usages

Variable usages use strict type compatibility by default. A nullable variable
cannot be used in a non-null position, even if the variable, argument, or input
field has a default value. This implements the strict algorithm proposed in
[GraphQL specification PR #1059](https://github.com/graphql/graphql-spec/pull/1059).

For example, given `sum(numbers: [Int!]!): Int`, this operation requires legacy
validation:

```graphql
query Sum($number: Int = 3) {
  sum(numbers: [1, $number, 3])
}
```

Change the variable declaration to `$number: Int! = 3` to make it valid under
strict validation. The variable can still be omitted; an explicitly supplied
`null` produces a variable coercion error before execution.

Use `allowLegacyVariableUsage: true` to preserve the previous validation behavior.
Supply `onLegacyVariableUsage` to log usages which strict validation would reject:

```js
const errors = validate(schema, document, undefined, {
  allowLegacyVariableUsage: true,
  onLegacyVariableUsage(warning, operation) {
    console.warn({
      operationName: operation.name?.value,
      message: warning.message,
      locations: warning.locations,
    });
  },
});
```

Omitting the callback disables migration warnings. These options also work on
`graphql()` and `graphqlSync()`. They apply when `VariablesInAllowedPositionRule`
is included in the rule list, as it is by default. Direct `execute()` callers must
validate documents separately.

The callback receives the error strict validation would report, including the
variable definition and usage nodes, and the containing operation. Shared
fragment usages are reported for each affected operation. Reporting a warning
does not add a validation error or prevent execution. A warning identifies an
incompatible variable usage; other validation rules can still reject the
document. Callback exceptions propagate to the caller.

Warnings do not consume `maxErrors`. OneOf input object fields continue to require
non-null variables in both modes, regardless of defaults.

When migrating an operation that relies on an argument or input-field default,
making its variable non-null requires callers to provide a value unless the
variable has its own default. Copying the schema default into the variable
declaration makes omission possible, but the operation will no longer follow
future changes to that schema default. Omitting the argument or input field
entirely continues to use its schema default.

Applications that cache validation results should distinguish strict and legacy
results and revalidate cached documents when enabling strict validation or
auditing existing operations. Logging only occurs when validation runs.
