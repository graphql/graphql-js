/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ASTValidationContext } from "../ValidationContext.mjs";
/**
 * Implements the max introspection depth validation rule.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { MaxIntrospectionDepthRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { __schema { types { fields { type { fields { type { fields { name } } } } } } } }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   MaxIntrospectionDepthRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { __schema { queryType { name } } }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   MaxIntrospectionDepthRule,
 * ]); // => []
 * ```
 */
export declare function MaxIntrospectionDepthRule(context: ASTValidationContext): ASTVisitor;
