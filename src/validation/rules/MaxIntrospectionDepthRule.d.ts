import { ASTVisitor } from '../../language/visitor';
import { SDLValidationContext } from '../ValidationContext';

export function MaxIntrospectionDepthRule(
  context: SDLValidationContext,
): ASTVisitor;
