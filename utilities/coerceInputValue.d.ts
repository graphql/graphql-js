import type { Maybe } from '../jsutils/Maybe.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import { GraphQLError } from '../error/GraphQLError.js';
import type { ValueNode } from '../language/ast.js';
import type { GraphQLInputType } from '../type/definition.js';
import type { FragmentVariables } from '../execution/collectFields.js';
type OnErrorCB = (path: ReadonlyArray<string | number>, invalidValue: unknown, error: GraphQLError) => void;
/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 */
export declare function coerceInputValue(inputValue: unknown, type: GraphQLInputType, onError?: OnErrorCB): unknown;
/**
 * Produces a coerced "internal" JavaScript value given a GraphQL Value AST.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 */
export declare function coerceInputLiteral(valueNode: ValueNode, type: GraphQLInputType, variableValues?: Maybe<ObjMap<unknown>>, fragmentVariableValues?: Maybe<FragmentVariables>): unknown;
export {};
