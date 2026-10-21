/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ValidationContext } from "../ValidationContext.mjs";
/**
 * Subscriptions must only include a non-introspection field.
 *
 * A GraphQL subscription is valid only if it contains a single root field and
 * that root field is not an introspection field.
 *
 * See https://spec.graphql.org/draft/#sec-Single-root-field
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { SingleFieldSubscriptionsRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 *
 *   type Subscription {
 *     a: String
 *     b: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   subscription { a b }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   SingleFieldSubscriptionsRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   subscription { a }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   SingleFieldSubscriptionsRule,
 * ]); // => []
 * ```
 */
export declare function SingleFieldSubscriptionsRule(context: ValidationContext): ASTVisitor;
