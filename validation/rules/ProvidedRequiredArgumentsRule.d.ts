import type { ASTVisitor } from '../../language/visitor.js';
import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext.js';
/**
 * Provided required arguments
 *
 * A field or directive is only valid if all required (non-null without a
 * default value) field arguments have been provided.
 */
export declare function ProvidedRequiredArgumentsRule(
  context: ValidationContext,
): ASTVisitor;
/**
 * @internal
 */
export declare function ProvidedRequiredArgumentsOnDirectivesRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor;
