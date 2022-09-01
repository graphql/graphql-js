import type { ASTVisitor } from '../../language/visitor.js';
import type { ValidationContext } from '../ValidationContext.js';
/**
 * Stream directive on list field
 *
 * A GraphQL document is only valid if stream directives are used on list fields.
 */
export declare function StreamDirectiveOnListFieldRule(
  context: ValidationContext,
): ASTVisitor;
