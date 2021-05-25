import type { GraphQLNamedType } from './definition';
import { GraphQLScalarType } from './definition';
export declare const GraphQLInt: GraphQLScalarType;
export declare const GraphQLFloat: GraphQLScalarType;
export declare const GraphQLString: GraphQLScalarType;
export declare const GraphQLBoolean: GraphQLScalarType;
export declare const GraphQLID: GraphQLScalarType;
export declare const specifiedScalarTypes: ReadonlyArray<GraphQLScalarType>;
export declare function isSpecifiedScalarType(type: GraphQLNamedType): boolean;
