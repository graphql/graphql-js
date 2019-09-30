import { ValidationContext, SDLValidationContext } from '../ValidationContext';
import { ASTVisitor } from '../../language/visitor';

/**
 * Known argument names
 *
 * A GraphQL field is only valid if all supplied arguments are defined by
 * that field.
 */
export function KnownArgumentNames(context: ValidationContext): ASTVisitor;

/**
 * @internal
 */
export function KnownArgumentNamesOnDirectives(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor;
