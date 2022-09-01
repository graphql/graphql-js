import type { ASTVisitor } from '../../language/visitor.js';
import type { ASTValidationContext } from '../ValidationContext.js';
/**
 * Unique variable names
 *
 * A GraphQL operation is only valid if all its variables are uniquely named.
 */
export declare function UniqueVariableNamesRule(
  context: ASTValidationContext,
): ASTVisitor;
