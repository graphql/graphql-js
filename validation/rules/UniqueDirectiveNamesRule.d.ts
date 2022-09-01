import type { ASTVisitor } from '../../language/visitor.js';
import type { SDLValidationContext } from '../ValidationContext.js';
/**
 * Unique directive names
 *
 * A GraphQL document is only valid if all defined directives have unique names.
 */
export declare function UniqueDirectiveNamesRule(
  context: SDLValidationContext,
): ASTVisitor;
