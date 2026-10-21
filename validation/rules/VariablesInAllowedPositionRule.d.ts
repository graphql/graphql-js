/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.js";
import type { ValidationContext } from "../ValidationContext.js";
/**
 * Variables in allowed position
 *
 * Variable usages must be compatible with the arguments they are passed to.
 *
 * See https://spec.graphql.org/draft/#sec-All-Variable-Usages-are-Allowed
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { VariablesInAllowedPositionRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(arg: ID!): String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   query ($id: String) { field(arg: $id) }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   VariablesInAllowedPositionRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   query ($id: ID!) { field(arg: $id) }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   VariablesInAllowedPositionRule,
 * ]); // => []
 * ```
 */
export declare function VariablesInAllowedPositionRule(context: ValidationContext): ASTVisitor;
