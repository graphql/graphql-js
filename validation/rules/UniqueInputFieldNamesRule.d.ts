/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.js";
import type { ASTValidationContext } from "../ValidationContext.js";
/**
 * Unique input field names
 *
 * A GraphQL input object value is only valid if all supplied fields are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Object-Field-Uniqueness
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { UniqueInputFieldNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   input Filter {
 *     name: String
 *   }
 *
 *   type Query {
 *     search(filter: Filter): String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { search(filter: { name: "a", name: "b" }) }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   UniqueInputFieldNamesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { search(filter: { name: "a" }) }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   UniqueInputFieldNamesRule,
 * ]); // => []
 * ```
 */
export declare function UniqueInputFieldNamesRule(context: ASTValidationContext): ASTVisitor;
