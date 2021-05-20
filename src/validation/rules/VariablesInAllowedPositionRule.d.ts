import type { ASTVisitor } from '../../language/visitor';
import type { ValidationContext } from '../ValidationContext';

/**
 * Variables passed to field arguments conform to type
 */
export function VariablesInAllowedPositionRule(
  context: ValidationContext,
): ASTVisitor;
