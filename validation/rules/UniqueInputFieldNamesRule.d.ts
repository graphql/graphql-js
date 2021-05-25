import type { ASTVisitor } from '../../language/visitor';
import type { ASTValidationContext } from '../ValidationContext';
/**
 * Unique input field names
 *
 * A GraphQL input object value is only valid if all supplied fields are
 * uniquely named.
 */
export declare function UniqueInputFieldNamesRule(
  context: ASTValidationContext,
): ASTVisitor;
