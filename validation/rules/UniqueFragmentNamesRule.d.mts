/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ASTValidationContext } from "../ValidationContext.mjs";
/**
 * Unique fragment names
 *
 * A GraphQL document is only valid if all defined fragments have unique names.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Name-Uniqueness
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { UniqueFragmentNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   fragment A on Query { name } fragment A on Query { name } query { ...A }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   UniqueFragmentNamesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   fragment A on Query { name } query { ...A }
 * `);
 * const validErrors = validate(schema, validDocument, [UniqueFragmentNamesRule]); // => []
 * ```
 */
export declare function UniqueFragmentNamesRule(context: ASTValidationContext): ASTVisitor;
