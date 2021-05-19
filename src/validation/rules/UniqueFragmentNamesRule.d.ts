import type { ASTVisitor } from '../../language/visitor';
import type { ASTValidationContext } from '../ValidationContext';

/**
 * Unique fragment names
 *
 * A GraphQL document is only valid if all defined fragments have unique names.
 */
export function UniqueFragmentNamesRule(
  context: ASTValidationContext,
): ASTVisitor;
