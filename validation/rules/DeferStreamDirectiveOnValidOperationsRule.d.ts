import type { ASTVisitor } from '../../language/visitor.js';
import type { ValidationContext } from '../ValidationContext.js';
/**
 * Defer And Stream Directives Are Used On Valid Operations
 *
 * A GraphQL document is only valid if defer directives are not used on root mutation or subscription types.
 */
export declare function DeferStreamDirectiveOnValidOperationsRule(
  context: ValidationContext,
): ASTVisitor;
