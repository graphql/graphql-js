/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.js";
import type { ValidationContext } from "../ValidationContext.js";
/**
 * Variables are input types
 *
 * A GraphQL operation is only valid if all the variables it defines are of
 * input types (scalar, enum, or input object).
 *
 * See https://spec.graphql.org/draft/#sec-Variables-Are-Input-Types
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { VariablesAreInputTypesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(arg: ID): String
 *   }
 *
 *   type User {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   query ($user: User) { field(arg: "1") }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   VariablesAreInputTypesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   query ($id: ID) { field(arg: $id) }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   VariablesAreInputTypesRule,
 * ]); // => []
 * ```
 */
export declare function VariablesAreInputTypesRule(context: ValidationContext): ASTVisitor;
