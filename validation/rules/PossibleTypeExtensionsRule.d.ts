import type { ASTVisitor } from '../../language/visitor.js';
import type { SDLValidationContext } from '../ValidationContext.js';
/**
 * Possible type extension
 *
 * A type extension is only valid if the type is defined and has the same kind.
 */
export declare function PossibleTypeExtensionsRule(
  context: SDLValidationContext,
): ASTVisitor;
