/** @category AST Utilities */
import type { ObjMap } from "../jsutils/ObjMap.js";
import type { DocumentNode } from "../language/ast.js";
/**
 * separateOperations accepts a single AST document which may contain many
 * operations and fragments and returns a collection of AST documents each of
 * which contains a single operation as well the fragment definitions it
 * refers to.
 * @param documentAST - The parsed GraphQL document AST.
 * @returns A map of operation names to documents containing each operation and its referenced fragments.
 * @example
 * ```ts
 * import { parse, print } from 'graphql/language';
 * import { separateOperations } from 'graphql/utilities';
 *
 * const document = parse(`
 *   query GetUser {
 *     viewer {
 *       ...UserFields
 *     }
 *   }
 *
 *   query GetStatus {
 *     status
 *   }
 *
 *   fragment UserFields on User {
 *     id
 *   }
 * `);
 *
 * const separated = separateOperations(document);
 *
 * Object.keys(separated); // => ['GetUser', 'GetStatus']
 * print(separated.GetUser).includes('fragment UserFields'); // => true
 * print(separated.GetStatus).includes('fragment UserFields'); // => false
 * ```
 */
export declare function separateOperations(documentAST: DocumentNode): ObjMap<DocumentNode>;
