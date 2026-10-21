/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ASTValidationContext } from "../ValidationContext.mjs";
/**
 * No unused fragments
 *
 * A GraphQL document is only valid if all fragment definitions are spread
 * within operations, or spread within other fragments spread within operations.
 *
 * See https://spec.graphql.org/draft/#sec-Fragments-Must-Be-Used
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { NoUnusedFragmentsRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   fragment Unused on Query { name } query { name }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   NoUnusedFragmentsRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   fragment Used on Query { name } query { ...Used }
 * `);
 * const validErrors = validate(schema, validDocument, [NoUnusedFragmentsRule]); // => []
 * ```
 */
export declare function NoUnusedFragmentsRule(context: ASTValidationContext): ASTVisitor;
