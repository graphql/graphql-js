import type { ASTVisitor } from '../../language/visitor';
import type { ASTValidationContext } from '../ValidationContext';
/**
 * Subscriptions must only include one field.
 *
 * A GraphQL subscription is valid only if it contains a single root field.
 */
export declare function SingleFieldSubscriptionsRule(
  context: ASTValidationContext,
): ASTVisitor;
