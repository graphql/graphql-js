/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ASTValidationContext } from "../ValidationContext.mjs";
/**
 * Unique argument names
 *
 * A GraphQL field or directive is only valid if all supplied arguments are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { UniqueArgumentNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(arg: String): String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { field(arg: "1", arg: "2") }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   UniqueArgumentNamesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { field(arg: "1") }
 * `);
 * const validErrors = validate(schema, validDocument, [UniqueArgumentNamesRule]); // => []
 * ```
 */
export declare function UniqueArgumentNamesRule(context: ASTValidationContext): ASTVisitor;
