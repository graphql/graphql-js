import type { ASTVisitor } from '../../language/visitor.js';
import type { ValidationContext } from '../ValidationContext.js';
/**
 * No undefined variables
 *
 * A GraphQL operation is only valid if all variables encountered, both directly
 * and via fragment spreads, are defined by that operation.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variable-Uses-Defined
 */
export declare function NoUndefinedVariablesRule(
  context: ValidationContext,
): ASTVisitor;
