import type { ASTVisitor } from '../../language/visitor';
import type { ASTValidationContext } from '../ValidationContext';
export function NoFragmentCyclesRule(context: ASTValidationContext): ASTVisitor;
