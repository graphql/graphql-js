/** @category Schema Printing */
import type { GraphQLNamedType } from "../type/definition.mjs";
import type { GraphQLDirective } from "../type/directives.mjs";
import type { GraphQLSchema } from "../type/schema.mjs";
/**
 * Prints the schema.
 * @param schema - GraphQL schema to use.
 * @returns The printed string representation.
 * @example
 * ```ts
 * import { buildSchema, printSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   directive @upper on FIELD_DEFINITION
 *
 *   type Query {
 *     greeting: String @upper
 *   }
 * `);
 *
 * printSchema(schema); // => ['directive @upper on FIELD_DEFINITION', '', 'type Query {', '  greeting: String', '}'].join('\n')
 * ```
 */
export declare function printSchema(schema: GraphQLSchema): string;
/**
 * Prints the introspection schema.
 * @param schema - GraphQL schema to use.
 * @returns The printed string representation.
 * @example
 * ```ts
 * import { buildSchema, printIntrospectionSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 *
 * const printed = printIntrospectionSchema(schema);
 *
 * printed; // matches /type __Schema/
 * printed; // matches /enum __TypeKind/
 * printed; // does not match /type Query/
 * ```
 */
export declare function printIntrospectionSchema(schema: GraphQLSchema): string;
/**
 * Prints the type.
 * @param type - The GraphQL type to inspect.
 * @returns The printed string representation.
 * @example
 * ```ts
 * import { buildSchema, printType } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type User {
 *     id: ID!
 *     name: String
 *   }
 *
 *   type Query {
 *     viewer: User
 *   }
 * `);
 *
 * printType(schema.getType('User')); // => ['type User {', '  id: ID!', '  name: String', '}'].join('\n')
 * ```
 */
export declare function printType(type: GraphQLNamedType): string;
/**
 * Prints a directive definition in GraphQL SDL.
 * @param directive - Directive to print.
 * @returns SDL string for the directive definition.
 * @example
 * ```ts
 * import { GraphQLDirective, GraphQLString } from 'graphql/type';
 * import { DirectiveLocation } from 'graphql/language';
 * import { printDirective } from 'graphql/utilities';
 *
 * const authDirective = new GraphQLDirective({
 *   name: 'auth',
 *   description: 'Requires authorization.',
 *   locations: [DirectiveLocation.FIELD_DEFINITION],
 *   args: {
 *     scope: { type: GraphQLString },
 *   },
 * });
 *
 * printDirective(authDirective); // => '"""Requires authorization."""\ndirective @auth(scope: String) on FIELD_DEFINITION'
 * ```
 */
export declare function printDirective(directive: GraphQLDirective): string;
