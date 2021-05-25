import type { ASTVisitor } from '../../language/visitor';
import type { ASTValidationContext } from '../ValidationContext';
export declare function NoFragmentCyclesRule(
  context: ASTValidationContext,
): ASTVisitor;
