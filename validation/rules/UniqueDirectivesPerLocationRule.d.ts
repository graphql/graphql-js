/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.js";
import type { SDLValidationContext, ValidationContext } from "../ValidationContext.js";
/**
 * Unique directive names per location
 *
 * A GraphQL document is only valid if all non-repeatable directives at
 * a given location are uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Unique-Per-Location
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { UniqueDirectivesPerLocationRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { name @include(if: true) @include(if: false) }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   UniqueDirectivesPerLocationRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { name @include(if: true) }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   UniqueDirectivesPerLocationRule,
 * ]); // => []
 * ```
 */
export declare function UniqueDirectivesPerLocationRule(context: ValidationContext | SDLValidationContext): ASTVisitor;
