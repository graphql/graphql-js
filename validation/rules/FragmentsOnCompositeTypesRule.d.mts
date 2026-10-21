/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ValidationContext } from "../ValidationContext.mjs";
/**
 * Fragments on composite type
 *
 * Fragments use a type condition to determine if they apply, since fragments
 * can only be spread into a composite type (object, interface, or union), the
 * type condition must also be a composite type.
 *
 * See https://spec.graphql.org/draft/#sec-Fragments-On-Composite-Types
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { FragmentsOnCompositeTypesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   fragment Bad on String { length }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   FragmentsOnCompositeTypesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   fragment Good on Query { name }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   FragmentsOnCompositeTypesRule,
 * ]); // => []
 * ```
 */
export declare function FragmentsOnCompositeTypesRule(context: ValidationContext): ASTVisitor;
