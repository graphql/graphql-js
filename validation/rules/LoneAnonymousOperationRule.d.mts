/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ASTValidationContext } from "../ValidationContext.mjs";
/**
 * Lone anonymous operation
 *
 * A GraphQL document is only valid if when it contains an anonymous operation
 * (the query short-hand) that it contains only that one operation definition.
 *
 * See https://spec.graphql.org/draft/#sec-Lone-Anonymous-Operation
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { LoneAnonymousOperationRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   query { name } query Other { name }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   LoneAnonymousOperationRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { name }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   LoneAnonymousOperationRule,
 * ]); // => []
 * ```
 */
export declare function LoneAnonymousOperationRule(context: ASTValidationContext): ASTVisitor;
