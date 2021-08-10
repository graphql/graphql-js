import type { GraphQLNamedType } from './definition';
import { GraphQLScalarType } from './definition';
export declare const GraphQLInt: GraphQLScalarType<number, number>;
export declare const GraphQLFloat: GraphQLScalarType<number, number>;
export declare const GraphQLString: GraphQLScalarType<string, string>;
export declare const GraphQLBoolean: GraphQLScalarType<boolean, boolean>;
export declare const GraphQLID: GraphQLScalarType<string, string>;
export declare const specifiedScalarTypes: ReadonlyArray<GraphQLScalarType>;
export declare function isSpecifiedScalarType(type: GraphQLNamedType): boolean;
