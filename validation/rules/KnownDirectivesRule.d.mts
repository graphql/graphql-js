/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { SDLValidationContext, ValidationContext } from "../ValidationContext.mjs";
/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Defined
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { KnownDirectivesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { name @unknown }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [KnownDirectivesRule]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { name @include(if: true) }
 * `);
 * const validErrors = validate(schema, validDocument, [KnownDirectivesRule]); // => []
 * ```
 */
export declare function KnownDirectivesRule(context: ValidationContext | SDLValidationContext): ASTVisitor;
