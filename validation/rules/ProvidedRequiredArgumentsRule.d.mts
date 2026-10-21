/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { SDLValidationContext, ValidationContext } from "../ValidationContext.mjs";
/**
 * Provided required arguments
 *
 * A field or directive is only valid if all required (non-null without a
 * default value) field arguments have been provided.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { ProvidedRequiredArgumentsRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(required: String!): String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { field }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   ProvidedRequiredArgumentsRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { field(required: "x") }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   ProvidedRequiredArgumentsRule,
 * ]); // => []
 * ```
 */
export declare function ProvidedRequiredArgumentsRule(context: ValidationContext): ASTVisitor;
/** @internal */
export declare function ProvidedRequiredArgumentsOnDirectivesRule(context: ValidationContext | SDLValidationContext): ASTVisitor;
