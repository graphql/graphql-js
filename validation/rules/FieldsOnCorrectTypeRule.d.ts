/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.js";
import type { ValidationContext } from "../ValidationContext.js";
/**
 * Fields on correct type
 *
 * A GraphQL document is only valid if all fields selected are defined by the
 * parent type, or are an allowed meta field such as __typename.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Selections
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { FieldsOnCorrectTypeRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { missing }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   FieldsOnCorrectTypeRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { name }
 * `);
 * const validErrors = validate(schema, validDocument, [FieldsOnCorrectTypeRule]); // => []
 * ```
 */
export declare function FieldsOnCorrectTypeRule(context: ValidationContext): ASTVisitor;
