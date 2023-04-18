import type { GraphQLNamedType } from '../type/definition.js';
import type { GraphQLDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';
export declare function printSchema(schema: GraphQLSchema): string;
export declare function printIntrospectionSchema(schema: GraphQLSchema): string;
export declare function printType(type: GraphQLNamedType): string;
export declare function printDirective(directive: GraphQLDirective): string;
