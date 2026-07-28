/** @category Validation Rules */

import type { ASTVisitor } from '../../language/visitor.ts';

import type { ValidationContext } from '../ValidationContext.ts';

import { ConflictDetector } from './OverlappingFieldsCanBeMergedHelpers/ConflictDetector.ts';

/**
 * Overlapping fields can be merged
 *
 * A selection set is only valid if all fields (including spreading any
 * fragments) either correspond to distinct response names or can be merged
 * without ambiguity.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Selection-Merging
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { OverlappingFieldsCanBeMergedRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     dog: Dog
 *   }
 *
 *   type Dog {
 *     name: String
 *     barkVolume: Int
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { dog { value: barkVolume value: name } }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   OverlappingFieldsCanBeMergedRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { dog { barkVolume name } }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   OverlappingFieldsCanBeMergedRule,
 * ]);
 *
 * validErrors; // => []
 * ```
 */
export function OverlappingFieldsCanBeMergedRule(
  context: ValidationContext,
): ASTVisitor {
  return new ConflictDetector(context).getVisitor();
}
