import type { Maybe } from '../jsutils/Maybe.js';
import type { ConstValueNode, ValueNode } from '../language/ast.js';
import type { FragmentVariableValues } from '../execution/collectFields.js';
import type { VariableValues } from '../execution/values.js';
/**
 * Replaces any Variables found within an AST Value literal with literals
 * supplied from a map of variable values, or removed if no variable replacement
 * exists, returning a constant value.
 *
 * Used primarily to ensure only complete constant values are used during input
 * coercion of custom scalars which accept complex literals.
 */
export declare function replaceVariables(valueNode: ValueNode, variableValues?: Maybe<VariableValues>, fragmentVariableValues?: Maybe<FragmentVariableValues>): ConstValueNode;
