import type { ASTVisitor } from '../../language/visitor.js';
import type { SDLValidationContext } from '../ValidationContext.js';
/**
 * Lone Schema definition
 *
 * A GraphQL document is only valid if it contains only one schema definition.
 */
export declare function LoneSchemaDefinitionRule(
  context: SDLValidationContext,
): ASTVisitor;
