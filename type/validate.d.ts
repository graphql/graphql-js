/** @category Validation */
import type { Maybe } from "../jsutils/Maybe.js";
import { GraphQLError } from "../error/GraphQLError.js";
import type { GraphQLDefaultInput, GraphQLInputType } from "./definition.js";
import type { GraphQLSchema } from "./schema.js";
/**
 * Implements the "Type Validation" sub-sections of the specification's
 * "Type System" section.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the Schema is valid.
 * @param schema - GraphQL schema to use.
 * @returns Schema validation errors, or an empty array when the schema is valid.
 * @example
 * ```ts
 * import { validateSchema } from 'graphql/type';
 * import { buildSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 * const errors = validateSchema(schema); // => []
 * ```
 */
export declare function validateSchema(schema: GraphQLSchema): ReadonlyArray<GraphQLError>;
/**
 * Utility function which asserts a schema is valid by throwing an error if
 * it is invalid.
 * @param schema - GraphQL schema to use.
 * @example
 * ```ts
 * import { assertValidSchema } from 'graphql/type';
 * import { buildSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * assertValidSchema(schema); // does not throw
 * ```
 */
export declare function assertValidSchema(schema: GraphQLSchema): void;
/** @internal */
export declare function validateDefaultInput(defaultInput: GraphQLDefaultInput, inputType: GraphQLInputType, onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void, hideSuggestions?: Maybe<boolean>): void;
