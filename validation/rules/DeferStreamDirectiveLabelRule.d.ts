import type { ASTVisitor } from '../../language/visitor';
import type { ValidationContext } from '../ValidationContext';
/**
 * Stream directive on list field
 *
 * A GraphQL document is only valid if defer and stream directives' label argument is static and unique.
 */
export declare function DeferStreamDirectiveLabelRule(
  context: ValidationContext,
): ASTVisitor;
