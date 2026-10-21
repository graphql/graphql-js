/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.js";
import type { ASTValidationContext } from "../ValidationContext.js";
/**
 * Unique variable names
 *
 * A GraphQL operation is only valid if all its variables are uniquely named.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { UniqueVariableNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(arg: ID): String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   query ($id: ID, $id: ID) { field(arg: $id) }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   UniqueVariableNamesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   query ($id: ID) { field(arg: $id) }
 * `);
 * const validErrors = validate(schema, validDocument, [UniqueVariableNamesRule]); // => []
 * ```
 */
export declare function UniqueVariableNamesRule(context: ASTValidationContext): ASTVisitor;
