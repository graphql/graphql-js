/** @category Validation Rules */
import type { ASTVisitor } from "../../language/visitor.js";
import type { ValidationContext } from "../ValidationContext.js";
/**
 * Defer And Stream Directives Are Used On Valid Operations
 *
 * Subscription operations must not use unconditional `@defer` or `@stream`.
 * Their `if` argument must be `false` or a variable, unless the selection or
 * an enclosing selection can be skipped via `@skip` or `@include`.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   validate,
 *   DeferStreamDirectiveOnValidOperationsRule,
 * } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     message: Message
 *   }
 *
 *   type Subscription {
 *     message: Message
 *   }
 *
 *   type Message {
 *     body: String
 *   }
 * `);
 * const invalidDocument = parse(`
 *   subscription {
 *     message {
 *       ...MessageBody @defer
 *     }
 *   }
 *
 *   fragment MessageBody on Message {
 *     body
 *   }
 * `);
 * const validDocument = parse(`
 *   subscription {
 *     message {
 *       ...MessageBody @defer(if: false)
 *     }
 *   }
 *
 *   fragment MessageBody on Message {
 *     body
 *   }
 * `);
 *
 * validate(schema, invalidDocument, [DeferStreamDirectiveOnValidOperationsRule])
 *   .length; // => 1
 * validate(schema, validDocument, [DeferStreamDirectiveOnValidOperationsRule]); // => []
 * ```
 */
export declare function DeferStreamDirectiveOnValidOperationsRule(context: ValidationContext): ASTVisitor;
