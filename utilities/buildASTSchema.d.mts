/** @category Schema Construction */
import type { DocumentNode } from "../language/ast.mjs";
import type { ParseOptions } from "../language/parser.mjs";
import type { Source } from "../language/source.mjs";
import type { GraphQLSchemaValidationOptions } from "../type/schema.mjs";
import { GraphQLSchema } from "../type/schema.mjs";
/** Options used when building a schema from SDL or a parsed SDL document. */
export interface BuildSchemaOptions extends GraphQLSchemaValidationOptions {
    /**
     * Set to true to assume the SDL is valid.
     *
     * Default: false
     */
    assumeValidSDL?: boolean | undefined;
}
/**
 * Builds a GraphQLSchema from a parsed schema definition language document.
 *
 * If no schema definition is provided, then it will look for types named Query,
 * Mutation and Subscription.
 *
 * The resulting schema has no resolver functions, so execution will use the
 * default field resolver.
 * @param documentAST - The parsed GraphQL document AST.
 * @param options - Optional configuration for this operation.
 * @returns The schema built from the provided SDL document.
 * @example
 * ```ts
 * // Build a schema from a valid parsed SDL document.
 * import { parse } from 'graphql/language';
 * import { buildASTSchema } from 'graphql/utilities';
 *
 * const document = parse('type Query { hello: String }');
 * const schema = buildASTSchema(document);
 *
 * schema.getQueryType().name; // => 'Query'
 * ```
 * @example
 * ```ts
 * // This variant uses validation options when the SDL references unknown types.
 * import { parse } from 'graphql/language';
 * import { buildASTSchema } from 'graphql/utilities';
 *
 * const document = parse('type Query { broken: MissingType }');
 *
 * buildASTSchema(document); // throws an error
 * buildASTSchema(document, {
 *   assumeValid: true,
 *   assumeValidSDL: true,
 * }); // does not throw
 * ```
 */
export declare function buildASTSchema(documentAST: DocumentNode, options?: BuildSchemaOptions): GraphQLSchema;
/**
 * Builds a GraphQLSchema directly from a schema definition language source.
 * @param source - The GraphQL source text or source object.
 * @param options - Optional configuration for this operation.
 * @returns The schema built from the provided SDL document.
 * @example
 * ```ts
 * // Build a schema from SDL source using the default options.
 * import { buildSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema('type Query { hello: String }');
 *
 * schema.getQueryType().name; // => 'Query'
 * ```
 * @example
 * ```ts
 * // This variant enables parser options and omits source locations.
 * import { buildSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(
 *   'directive @tag on DIRECTIVE_DEFINITION\n' +
 *     'directive @compose @tag on FIELD_DEFINITION',
 *   {
 *     experimentalFragmentArguments: true,
 *     noLocation: true,
 *   },
 * );
 *
 * const directive = schema.getDirective('compose');
 *
 * directive.name; // => 'compose'
 * directive.astNode.loc; // => undefined
 * ```
 */
export declare function buildSchema(source: string | Source, options?: BuildSchemaOptions & ParseOptions): GraphQLSchema;
