/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ASTValidationContext } from "../ValidationContext.mjs";
/**
 * Unique operation names
 *
 * A GraphQL document is only valid if all defined operations have unique names.
 *
 * See https://spec.graphql.org/draft/#sec-Operation-Name-Uniqueness
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { UniqueOperationNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   query Same { name } query Same { name }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   UniqueOperationNamesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   query One { name } query Two { name }
 * `);
 * const validErrors = validate(schema, validDocument, [UniqueOperationNamesRule]); // => []
 * ```
 */
export declare function UniqueOperationNamesRule(context: ASTValidationContext): ASTVisitor;
