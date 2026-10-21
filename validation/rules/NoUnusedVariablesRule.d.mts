/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ValidationContext } from "../ValidationContext.mjs";
/**
 * No unused variables
 *
 * A GraphQL operation is only valid if all variables defined by an operation
 * are used, either directly or within a spread fragment.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variables-Used
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { NoUnusedVariablesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(arg: ID): String
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   query ($id: ID) { name }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   NoUnusedVariablesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   query ($id: ID) { field(arg: $id) }
 * `);
 * const validErrors = validate(schema, validDocument, [NoUnusedVariablesRule]); // => []
 * ```
 */
export declare function NoUnusedVariablesRule(context: ValidationContext): ASTVisitor;
