import { ASTVisitor } from '../../language/visitor';
import { ValidationContext } from '../ValidationContext';

export function NoFragmentCycles(context: ValidationContext): ASTVisitor;
