import { GraphQLScalarType } from './definition';

export const GraphQLInt: GraphQLScalarType & { name: 'Int' };
export const GraphQLFloat: GraphQLScalarType & { name: 'Float' };
export const GraphQLString: GraphQLScalarType & { name: 'String' };
export const GraphQLBoolean: GraphQLScalarType & { name: 'Boolean' };
export const GraphQLID: GraphQLScalarType & { name: 'ID' };

export type SpecifiedScalarType =
  | typeof GraphQLInt
  | typeof GraphQLFloat
  | typeof GraphQLString
  | typeof GraphQLBoolean
  | typeof GraphQLID;

export const specifiedScalarTypes: ReadonlyArray<SpecifiedScalarType>;

export function isSpecifiedScalarType(type: any): type is SpecifiedScalarType;
