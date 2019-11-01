import { ASTVisitor } from '../../language/visitor';
import { ValidationContext, SDLValidationContext } from '../ValidationContext';

/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 */
export function KnownDirectives(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor;
