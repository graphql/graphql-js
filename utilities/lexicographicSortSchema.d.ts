/** @category Schema Construction */
import { GraphQLSchema } from "../type/schema.js";
/**
 * Sort GraphQLSchema.
 *
 * This function returns a sorted copy of the given GraphQLSchema.
 * @param schema - GraphQL schema to use.
 * @returns A copy of the schema with types, fields, arguments, and values sorted lexicographically.
 * @example
 * ```ts
 * import {
 *   buildSchema,
 *   lexicographicSortSchema,
 *   printSchema,
 * } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     zebra: String
 *     apple: String
 *   }
 *
 *   enum Episode {
 *     JEDI
 *     NEW_HOPE
 *     EMPIRE
 *   }
 * `);
 *
 * const sortedSchema = lexicographicSortSchema(schema);
 *
 * const expectedSDL = `enum Episode {
 *   EMPIRE
 *   JEDI
 *   NEW_HOPE
 * }
 *
 * type Query {
 *   apple: String
 *   zebra: String
 * }`;
 *
 * printSchema(sortedSchema); // => expectedSDL
 * ```
 */
export declare function lexicographicSortSchema(schema: GraphQLSchema): GraphQLSchema;
