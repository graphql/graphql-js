/** @category Custom Rules */
import type { ASTVisitor } from "../../../language/visitor.mjs";
import type { ValidationContext } from "../../ValidationContext.mjs";
/**
 * Prohibit introspection queries
 *
 * A GraphQL document is only valid if all fields selected are not fields that
 * return an introspection type.
 *
 * Note: This rule is optional and is not part of the Validation section of the
 * GraphQL Specification. This rule effectively disables introspection, which
 * does not reflect best practices and should only be done if absolutely necessary.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { NoSchemaIntrospectionCustomRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { __schema { queryType { name } } }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   NoSchemaIntrospectionCustomRule,
 * ]);
 *
 * invalidErrors.length; // => 2
 *
 * const validDocument = parse(`
 *   { name }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   NoSchemaIntrospectionCustomRule,
 * ]); // => []
 * ```
 */
export declare function NoSchemaIntrospectionCustomRule(context: ValidationContext): ASTVisitor;
