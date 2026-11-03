/** @category Introspection */
import type { GraphQLSchemaValidationOptions } from "../type/schema.mjs";
import { GraphQLSchema } from "../type/schema.mjs";
import type { IntrospectionQuery } from "./getIntrospectionQuery.mjs";
/**
 * Build a GraphQLSchema for use by client tools.
 *
 * Given the result of a client running the introspection query, creates and
 * returns a GraphQLSchema instance which can be then used with all graphql-js
 * tools, but cannot be used to execute a query, as introspection does not
 * represent the "resolver", "parse" or "serialize" functions or any other
 * server-internal mechanisms.
 *
 * This function expects a complete introspection result. Don't forget to check
 * the "errors" field of a server response before calling this function.
 * @param introspection - Introspection result data to build from.
 * @param options - Optional configuration for this operation.
 * @returns The client schema represented by the introspection result.
 * @example
 * ```ts
 * import {
 *   buildClientSchema,
 *   introspectionFromSchema,
 *   buildSchema,
 * } from 'graphql/utilities';
 *
 * const schema = buildSchema('type Query { hello: String }');
 * const clientSchema = buildClientSchema(introspectionFromSchema(schema), {
 *   assumeValid: true,
 * });
 *
 * clientSchema.getQueryType()?.name; // => 'Query'
 * ```
 */
export declare function buildClientSchema(introspection: IntrospectionQuery, options?: GraphQLSchemaValidationOptions): GraphQLSchema;
