import type { ASTVisitor } from '../../language/visitor.js';
import type { ASTValidationContext } from '../ValidationContext.js';
/**
 * Unique argument names
 *
 * A GraphQL field or directive is only valid if all supplied arguments are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 */
export declare function UniqueArgumentNamesRule(
  context: ASTValidationContext,
): ASTVisitor;
