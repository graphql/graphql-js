import type { Maybe } from '../jsutils/Maybe.js';
import { GraphQLError } from '../error/GraphQLError.js';
import type { ValueNode } from '../language/ast.js';
import type { GraphQLInputType } from '../type/definition.js';
import type { VariableValues } from '../execution/values.js';
/**
 * Validate that the provided input value is allowed for this type, collecting
 * all errors via a callback function.
 */
export declare function validateInputValue(inputValue: unknown, type: GraphQLInputType, onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void, hideSuggestions?: Maybe<boolean>): void;
/**
 * Validate that the provided input literal is allowed for this type, collecting
 * all errors via a callback function.
 *
 * If variable values are not provided, the literal is validated statically
 * (not assuming that those variables are missing runtime values).
 */
export declare function validateInputLiteral(valueNode: ValueNode, type: GraphQLInputType, onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void, variables?: Maybe<VariableValues>, fragmentVariableValues?: Maybe<VariableValues>, hideSuggestions?: Maybe<boolean>): void;
