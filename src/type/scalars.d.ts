import { GraphQLScalarType, GraphQLNamedType } from './definition';

export const GraphQLInt: GraphQLScalarType;
export const GraphQLFloat: GraphQLScalarType;
export const GraphQLString: GraphQLScalarType;
export const GraphQLBoolean: GraphQLScalarType;
export const GraphQLID: GraphQLScalarType;

export declare const MAX_INT: number;
export declare const MIN_INT: number;

export const specifiedScalarTypes: ReadonlyArray<GraphQLScalarType>;

export function isSpecifiedScalarType(type: GraphQLNamedType): boolean;
