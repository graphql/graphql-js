/** @category Values */
import type { Maybe } from "../jsutils/Maybe.mjs";
import type { ConstValueNode, ValueNode } from "../language/ast.mjs";
import type { FragmentVariableValues } from "../execution/collectFields.mjs";
import type { VariableValues } from "../execution/values.mjs";
/**
 * Replaces any Variables found within an AST Value literal with literals
 * supplied from a map of variable values, or removed if no variable replacement
 * exists, returning a constant value.
 *
 * Used primarily to ensure only complete constant values are used during input
 * coercion of custom scalars which accept complex literals.
 * @param valueNode - Value AST node in which variables should be replaced.
 * @param variableValues - Operation variable values returned by getVariableValues.
 * @param fragmentVariableValues - Fragment variable values for the current fragment scope.
 * @returns A constant value AST with variables replaced.
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { parse, parseValue, print, Kind } from 'graphql/language';
 * import { getVariableValues } from 'graphql/execution';
 * import { buildSchema, replaceVariables } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     review(stars: Int = 5): String
 *   }
 * `);
 * const document = parse('query ($stars: Int = 5) { review(stars: $stars) }');
 * const operation = document.definitions[0];
 * assert(operation.kind === Kind.OPERATION_DEFINITION);
 * const result = getVariableValues(schema, operation.variableDefinitions ?? [], {
 *   stars: 4,
 * });
 *
 * assert('variableValues' in result);
 *
 * const literal = replaceVariables(
 *   parseValue('{ stars: $stars, comment: $missing }'),
 *   result.variableValues,
 * );
 *
 * print(literal); // => '{ stars: 4 }'
 * ```
 */
export declare function replaceVariables(valueNode: ValueNode, variableValues?: Maybe<VariableValues>, fragmentVariableValues?: Maybe<FragmentVariableValues>): ConstValueNode;
