import type { ASTVisitor } from '../../language/visitor.js';
import type { ValidationContext } from '../ValidationContext.js';
export declare function MaxIntrospectionDepthRule(
  context: ValidationContext,
): ASTVisitor;
