/** @category Custom Rules */
import type { ASTVisitor } from "../../../language/visitor.mjs";
import type { ValidationContext } from "../../ValidationContext.mjs";
/**
 * No deprecated
 *
 * A GraphQL document is only valid if all selected fields and all used enum values have not been
 * deprecated.
 *
 * Note: This rule is optional and is not part of the Validation section of the GraphQL
 * Specification. The main purpose of this rule is detection of deprecated usages and not
 * necessarily to forbid their use when querying a service.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import {
 *   GraphQLObjectType,
 *   GraphQLSchema,
 *   GraphQLString,
 *   parse,
 *   validate,
 * } from 'graphql';
 * import { NoDeprecatedCustomRule } from 'graphql/validation';
 *
 * const schema = new GraphQLSchema({
 *   query: new GraphQLObjectType({
 *     name: 'Query',
 *     fields: {
 *       name: { type: GraphQLString },
 *       oldName: {
 *         type: GraphQLString,
 *         deprecationReason: 'Use name instead.',
 *       },
 *     },
 *   }),
 * });
 *
 * const invalidDocument = parse(`
 *   { oldName }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   NoDeprecatedCustomRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { name }
 * `);
 * const validErrors = validate(schema, validDocument, [NoDeprecatedCustomRule]); // => []
 * ```
 */
export declare function NoDeprecatedCustomRule(context: ValidationContext): ASTVisitor;
