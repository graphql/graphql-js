/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ASTValidationContext } from "../ValidationContext.mjs";
/**
 * No fragment cycles
 *
 * The graph of fragment spreads must not form any cycles including spreading itself.
 * Otherwise an operation could infinitely spread or infinitely execute on cycles in the underlying data.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-spreads-must-not-form-cycles
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { NoFragmentCyclesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   fragment A on Query { ...B } fragment B on Query { ...A } query { ...A }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [NoFragmentCyclesRule]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   fragment A on Query { name } query { ...A }
 * `);
 * const validErrors = validate(schema, validDocument, [NoFragmentCyclesRule]); // => []
 * ```
 */
export declare function NoFragmentCyclesRule(context: ASTValidationContext): ASTVisitor;
