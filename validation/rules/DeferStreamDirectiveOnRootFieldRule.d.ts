import type { ASTVisitor } from '../../language/visitor.js';
import type { ValidationContext } from '../ValidationContext.js';
/**
 * Stream directive on list field
 *
 * A GraphQL document is only valid if defer directives are not used on root mutation or subscription types.
 */
export declare function DeferStreamDirectiveOnRootFieldRule(
  context: ValidationContext,
): ASTVisitor;
