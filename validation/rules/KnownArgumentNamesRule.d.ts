import type {
  ValidationContext,
  SDLValidationContext,
} from '../ValidationContext';
import type { ASTVisitor } from '../../language/visitor';
/**
 * Known argument names
 *
 * A GraphQL field is only valid if all supplied arguments are defined by
 * that field.
 */
export function KnownArgumentNamesRule(context: ValidationContext): ASTVisitor;
/**
 * @internal
 */
export function KnownArgumentNamesOnDirectivesRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor;
