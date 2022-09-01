import type { ASTVisitor } from '../../language/visitor.js';
import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext.js';
/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Defined
 */
export declare function KnownDirectivesRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor;
