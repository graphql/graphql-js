/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { SDLValidationContext, ValidationContext } from "../ValidationContext.mjs";
/**
 * Known type names
 *
 * A GraphQL document is only valid if referenced types (specifically
 * variable definitions and fragment conditions) are defined by the type schema.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Spread-Type-Existence
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { KnownTypeNamesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   fragment Bad on Missing { name }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [KnownTypeNamesRule]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   fragment Good on Query { name }
 * `);
 * const validErrors = validate(schema, validDocument, [KnownTypeNamesRule]); // => []
 * ```
 */
export declare function KnownTypeNamesRule(context: ValidationContext | SDLValidationContext): ASTVisitor;
