import type { ASTVisitor } from '../../language/visitor.js';
import type { ASTValidationContext } from '../ValidationContext.js';
/**
 * Executable definitions
 *
 * A GraphQL document is only valid for execution if all definitions are either
 * operation or fragment definitions.
 *
 * See https://spec.graphql.org/draft/#sec-Executable-Definitions
 */
export declare function ExecutableDefinitionsRule(
  context: ASTValidationContext,
): ASTVisitor;
