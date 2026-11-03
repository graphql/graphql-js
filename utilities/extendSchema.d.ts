/** @category Schema Construction */
import type { DocumentNode } from "../language/ast.js";
import type { GraphQLSchemaNormalizedConfig, GraphQLSchemaValidationOptions } from "../type/schema.js";
import { GraphQLSchema } from "../type/schema.js";
interface Options extends GraphQLSchemaValidationOptions {
    /**
     * Set to true to assume the SDL is valid.
     *
     * Default: false
     *
     * @internal
     */
    assumeValidSDL?: boolean | undefined;
}
/**
 * Produces a new schema given an existing schema and a document which may
 * contain GraphQL type extensions and definitions. The original schema will
 * remain unaltered.
 *
 * Because a schema represents a graph of references, a schema cannot be
 * extended without effectively making an entire copy. We do not know until it's
 * too late if subgraphs remain unchanged.
 *
 * This algorithm copies the provided schema, applying extensions while
 * producing the copy. The original schema remains unaltered.
 * @param schema - GraphQL schema to use.
 * @param documentAST - The parsed GraphQL document AST.
 * @param options - Optional configuration for this operation.
 * @returns A new schema with the extensions and definitions applied.
 * @example
 * ```ts
 * // Extend a schema with new fields and types.
 * import assert from 'node:assert/strict';
 * import { parse } from 'graphql/language';
 * import { buildSchema, extendSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const extensionAST = parse(`
 *   extend type Query {
 *     farewell: String
 *   }
 *
 *   type Review {
 *     body: String
 *   }
 * `);
 *
 * const extendedSchema = extendSchema(schema, extensionAST);
 *
 * schema.getType('Review'); // => undefined
 * extendedSchema.getType('Review')?.name; // => 'Review'
 * const queryType = extendedSchema.getQueryType();
 * assert(queryType);
 * Object.keys(queryType.getFields()); // => ['greeting', 'farewell']
 * ```
 * @example
 * ```ts
 * // This variant bypasses validation for an otherwise invalid extension.
 * import { parse } from 'graphql/language';
 * import { buildSchema, extendSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const invalidExtension = parse(`
 *   extend type Missing {
 *     field: String
 *   }
 * `);
 *
 * extendSchema(schema, invalidExtension); // throws an error
 * extendSchema(schema, invalidExtension, {
 *   assumeValid: true,
 *   assumeValidSDL: true,
 * }); // does not throw
 * ```
 */
export declare function extendSchema(schema: GraphQLSchema, documentAST: DocumentNode, options?: Options): GraphQLSchema;
/** @internal */
export declare function extendSchemaImpl(schemaConfig: GraphQLSchemaNormalizedConfig, documentAST: DocumentNode, options?: Options): GraphQLSchemaNormalizedConfig;
export {};
