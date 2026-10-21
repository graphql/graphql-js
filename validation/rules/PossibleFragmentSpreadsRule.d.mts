/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.mjs";
import type { ValidationContext } from "../ValidationContext.mjs";
/**
 * Possible fragment spread
 *
 * A fragment spread is only valid if the type condition could ever possibly
 * be true: if there is a non-empty intersection of the possible parent types,
 * and possible types which pass the type condition.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { PossibleFragmentSpreadsRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     dog: Dog
 *   }
 *
 *   type Dog {
 *     barkVolume: Int
 *   }
 *
 *   type Cat {
 *     meowVolume: Int
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { dog { ... on Cat { meowVolume } } }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   PossibleFragmentSpreadsRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { dog { ... on Dog { barkVolume } } }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   PossibleFragmentSpreadsRule,
 * ]); // => []
 * ```
 */
export declare function PossibleFragmentSpreadsRule(context: ValidationContext): ASTVisitor;
