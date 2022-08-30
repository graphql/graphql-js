import type { ASTVisitor } from '../../language/visitor';
import type { ValidationContext } from '../ValidationContext';
/**
 * Stream directive on list field
 *
 * A GraphQL document is only valid if stream directives are used on list fields.
 */
export declare function StreamDirectiveOnListFieldRule(
  context: ValidationContext,
): ASTVisitor;
