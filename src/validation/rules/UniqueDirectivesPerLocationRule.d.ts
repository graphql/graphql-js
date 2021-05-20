import type { ASTVisitor } from '../../language/visitor';
import type { ASTValidationContext } from '../ValidationContext';

/**
 * Unique directive names per location
 *
 * A GraphQL document is only valid if all directives at a given location
 * are uniquely named.
 */
export function UniqueDirectivesPerLocationRule(
  context: ASTValidationContext,
): ASTVisitor;
