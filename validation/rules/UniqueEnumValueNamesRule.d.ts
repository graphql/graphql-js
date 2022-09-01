import type { ASTVisitor } from '../../language/visitor.js';
import type { SDLValidationContext } from '../ValidationContext.js';
/**
 * Unique enum value names
 *
 * A GraphQL enum type is only valid if all its values are uniquely named.
 */
export declare function UniqueEnumValueNamesRule(
  context: SDLValidationContext,
): ASTVisitor;
