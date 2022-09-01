import type { ASTVisitor } from '../../language/visitor.js';
import type { SDLValidationContext } from '../ValidationContext.js';
/**
 * Unique operation types
 *
 * A GraphQL document is only valid if it has only one type per operation.
 */
export declare function UniqueOperationTypesRule(
  context: SDLValidationContext,
): ASTVisitor;
