/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { SDLValidationContext, ValidationContext } from "../ValidationContext.mjs";
/**
 * Known argument names
 *
 * A GraphQL field is only valid if all supplied arguments are defined by
 * that field.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 * See https://spec.graphql.org/draft/#sec-Directives-Are-In-Valid-Locations
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { KnownArgumentNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(arg: String): String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { field(unknown: "1") }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   KnownArgumentNamesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { field(arg: "1") }
 * `);
 * const validErrors = validate(schema, validDocument, [KnownArgumentNamesRule]); // => []
 * ```
 */
export declare function KnownArgumentNamesRule(context: ValidationContext): ASTVisitor;
/** @internal */
export declare function KnownArgumentNamesOnDirectivesRule(context: ValidationContext | SDLValidationContext): ASTVisitor;
