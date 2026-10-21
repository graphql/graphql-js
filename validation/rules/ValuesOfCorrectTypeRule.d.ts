/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.js";
import type { ValidationContext } from "../ValidationContext.js";
/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 *
 * See https://spec.graphql.org/draft/#sec-Values-of-Correct-Type
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { ValuesOfCorrectTypeRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     count(limit: Int): Int
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { count(limit: "many") }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   ValuesOfCorrectTypeRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { count(limit: 1) }
 * `);
 * const validErrors = validate(schema, validDocument, [ValuesOfCorrectTypeRule]); // => []
 * ```
 */
export declare function ValuesOfCorrectTypeRule(context: ValidationContext): ASTVisitor;
