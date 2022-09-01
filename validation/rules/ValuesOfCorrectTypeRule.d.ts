import type { ASTVisitor } from '../../language/visitor.js';
import type { ValidationContext } from '../ValidationContext.js';
/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 *
 * See https://spec.graphql.org/draft/#sec-Values-of-Correct-Type
 */
export declare function ValuesOfCorrectTypeRule(
  context: ValidationContext,
): ASTVisitor;
