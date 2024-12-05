import type { ASTVisitor } from '../../language/visitor.js';
import type { ValidationContext } from '../ValidationContext.js';
/**
 * Known Operation Types
 *
 * A GraphQL document is only valid if when it contains an operation,
 * the root type for the operation exists within the schema.
 *
 * See https://spec.graphql.org/draft/#sec-Operation-Type-Existence
 */
export declare function KnownOperationTypesRule(context: ValidationContext): ASTVisitor;
