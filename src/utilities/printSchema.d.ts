import type { GraphQLSchema } from '../type/schema';
import type { GraphQLNamedType } from '../type/definition';

export function printSchema(schema: GraphQLSchema): string;

export function printIntrospectionSchema(schema: GraphQLSchema): string;

export function printType(type: GraphQLNamedType): string;
