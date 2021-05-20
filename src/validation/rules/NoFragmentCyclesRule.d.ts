import type { ASTVisitor } from '../../language/visitor';
import type { ValidationContext } from '../ValidationContext';
export function NoFragmentCyclesRule(context: ValidationContext): ASTVisitor;
