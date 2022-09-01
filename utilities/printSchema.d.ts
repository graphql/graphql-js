import type { GraphQLNamedType } from '../type/definition.js';
import type { GraphQLSchema } from '../type/schema.js';
export declare function printSchema(schema: GraphQLSchema): string;
export declare function printIntrospectionSchema(schema: GraphQLSchema): string;
export declare function printType(type: GraphQLNamedType): string;
