import type { ASTVisitor } from '../../language/visitor.js';
import type { SDLValidationContext } from '../ValidationContext.js';
/**
 * Unique field definition names
 *
 * A GraphQL complex type is only valid if all its fields are uniquely named.
 */
export declare function UniqueFieldDefinitionNamesRule(
  context: SDLValidationContext,
): ASTVisitor;
