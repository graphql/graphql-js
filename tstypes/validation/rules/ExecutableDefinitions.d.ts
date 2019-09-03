import { ASTVisitor } from '../../language/visitor';
import { ASTValidationContext } from '../ValidationContext';

/**
 * Executable definitions
 *
 * A GraphQL document is only valid for execution if all definitions are either
 * operation or fragment definitions.
 */
export function ExecutableDefinitions(
  context: ASTValidationContext,
): ASTVisitor;
