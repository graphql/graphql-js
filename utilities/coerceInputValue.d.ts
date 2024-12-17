import type { Maybe } from '../jsutils/Maybe.js';
import type { ValueNode } from '../language/ast.js';
import type { GraphQLDefaultInput, GraphQLInputType } from '../type/definition.js';
import type { VariableValues } from '../execution/values.js';
/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 */
export declare function coerceInputValue(inputValue: unknown, type: GraphQLInputType): unknown;
/**
 * Produces a coerced "internal" JavaScript value given a GraphQL Value AST.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 */
export declare function coerceInputLiteral(valueNode: ValueNode, type: GraphQLInputType, variableValues?: Maybe<VariableValues>, fragmentVariableValues?: Maybe<VariableValues>): unknown;
interface InputValue {
    type: GraphQLInputType;
    default?: GraphQLDefaultInput | undefined;
    defaultValue?: unknown;
}
/**
 * @internal
 */
export declare function coerceDefaultValue(inputValue: InputValue): unknown;
export {};
