/** @category Types */

import { devAssert } from '../jsutils/devAssert';
import { didYouMean } from '../jsutils/didYouMean';
import { identityFunc } from '../jsutils/identityFunc';
import { inspect } from '../jsutils/inspect';
import { instanceOf } from '../jsutils/instanceOf';
import { isObjectLike } from '../jsutils/isObjectLike';
import { keyMap } from '../jsutils/keyMap';
import { keyValMap } from '../jsutils/keyValMap';
import { mapValue } from '../jsutils/mapValue';
import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import type { Path } from '../jsutils/Path';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { suggestionList } from '../jsutils/suggestionList';
import { toObjMap } from '../jsutils/toObjMap';

import { GraphQLError } from '../error/GraphQLError';

import type {
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  OperationDefinitionNode,
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
  ValueNode,
} from '../language/ast';
import { Kind } from '../language/kinds';
import { print } from '../language/printer';

import { valueFromASTUntyped } from '../utilities/valueFromASTUntyped';

import { assertEnumValueName, assertName } from './assertName';
import type { GraphQLSchema } from './schema';

// Predicates & Assertions

/** These are all of the possible kinds of types. */
export type GraphQLType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLInputObjectType
  | GraphQLList<GraphQLType>
  | GraphQLNonNull<
      | GraphQLScalarType
      | GraphQLObjectType
      | GraphQLInterfaceType
      | GraphQLUnionType
      | GraphQLEnumType
      | GraphQLInputObjectType
      | GraphQLList<GraphQLType>
    >;

/**
 * Returns true when the value is any GraphQL type.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is any GraphQL type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { GraphQLList, GraphQLString, isType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * isType(GraphQLString); // => true
 * isType(new GraphQLList(GraphQLString)); // => true
 * isType(schema.getType('Query')); // => true
 * isType('String'); // => false
 * ```
 */
export function isType(type: unknown): type is GraphQLType {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    isListType(type) ||
    isNonNullType(type)
  );
}

/**
 * Returns the value as a GraphQL type, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQL type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 * `);
 *
 * const queryType = assertType(schema.getType('Query'));
 *
 * queryType.toString(); // => 'Query'
 * assertType('Query'); // throws an error
 * ```
 */
export function assertType(type: unknown): GraphQLType {
  if (!isType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL type.`);
  }
  return type;
}

/**
 * There are predicates for each kind of GraphQL type.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQLScalarType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isScalarType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   scalar DateTime
 *
 *   type Query {
 *     createdAt: DateTime
 *   }
 * `);
 *
 * isScalarType(schema.getType('DateTime')); // => true
 * isScalarType(schema.getType('Query')); // => false
 * ```
 */
export function isScalarType(type: unknown): type is GraphQLScalarType {
  return instanceOf(type, GraphQLScalarType);
}

/**
 * Returns the value as a GraphQLScalarType, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQLScalarType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertScalarType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   scalar DateTime
 *
 *   type Query {
 *     createdAt: DateTime
 *   }
 * `);
 *
 * const dateTimeType = assertScalarType(schema.getType('DateTime'));
 *
 * dateTimeType.name; // => 'DateTime'
 * assertScalarType(schema.getType('Query')); // throws an error
 * ```
 */
export function assertScalarType(type: unknown): GraphQLScalarType {
  if (!isScalarType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Scalar type.`);
  }
  return type;
}

/**
 * Returns true when the value is a GraphQLObjectType.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQLObjectType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isObjectType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type User {
 *     name: String
 *   }
 *
 *   type Query {
 *     user: User
 *   }
 * `);
 *
 * isObjectType(schema.getType('User')); // => true
 * isObjectType(schema.getType('ReviewInput')); // => false
 * ```
 */
export function isObjectType(type: unknown): type is GraphQLObjectType {
  return instanceOf(type, GraphQLObjectType);
}

/**
 * Returns the value as a GraphQLObjectType, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQLObjectType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertObjectType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type User {
 *     name: String
 *   }
 *
 *   type Query {
 *     user: User
 *   }
 * `);
 *
 * const userType = assertObjectType(schema.getType('User'));
 *
 * Object.keys(userType.getFields()); // => ['name']
 * assertObjectType(schema.getType('ReviewInput')); // throws an error
 * ```
 */
export function assertObjectType(type: unknown): GraphQLObjectType {
  if (!isObjectType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Object type.`);
  }
  return type;
}

/**
 * Returns true when the value is a GraphQLInterfaceType.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQLInterfaceType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isInterfaceType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   interface Node {
 *     id: ID!
 *   }
 *
 *   type User implements Node {
 *     id: ID!
 *   }
 *
 *   type Query {
 *     node: Node
 *   }
 * `);
 *
 * isInterfaceType(schema.getType('Node')); // => true
 * isInterfaceType(schema.getType('User')); // => false
 * ```
 */
export function isInterfaceType(type: unknown): type is GraphQLInterfaceType {
  return instanceOf(type, GraphQLInterfaceType);
}

/**
 * Returns the value as a GraphQLInterfaceType, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQLInterfaceType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertInterfaceType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   interface Node {
 *     id: ID!
 *   }
 *
 *   type User implements Node {
 *     id: ID!
 *   }
 *
 *   type Query {
 *     node: Node
 *   }
 * `);
 *
 * const nodeType = assertInterfaceType(schema.getType('Node'));
 *
 * nodeType.name; // => 'Node'
 * assertInterfaceType(schema.getType('User')); // throws an error
 * ```
 */
export function assertInterfaceType(type: unknown): GraphQLInterfaceType {
  if (!isInterfaceType(type)) {
    throw new Error(
      `Expected ${inspect(type)} to be a GraphQL Interface type.`,
    );
  }
  return type;
}

/**
 * Returns true when the value is a GraphQLUnionType.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQLUnionType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isUnionType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type Photo {
 *     url: String!
 *   }
 *
 *   type Video {
 *     url: String!
 *   }
 *
 *   union Media = Photo | Video
 *
 *   type Query {
 *     media: [Media]
 *   }
 * `);
 *
 * isUnionType(schema.getType('Media')); // => true
 * isUnionType(schema.getType('Photo')); // => false
 * ```
 */
export function isUnionType(type: unknown): type is GraphQLUnionType {
  return instanceOf(type, GraphQLUnionType);
}

/**
 * Returns the value as a GraphQLUnionType, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQLUnionType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertUnionType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type Photo {
 *     url: String!
 *   }
 *
 *   type Video {
 *     url: String!
 *   }
 *
 *   union Media = Photo | Video
 *
 *   type Query {
 *     media: [Media]
 *   }
 * `);
 *
 * const mediaType = assertUnionType(schema.getType('Media'));
 *
 * mediaType.getTypes().map((type) => type.name); // => ['Photo', 'Video']
 * assertUnionType(schema.getType('Photo')); // throws an error
 * ```
 */
export function assertUnionType(type: unknown): GraphQLUnionType {
  if (!isUnionType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Union type.`);
  }
  return type;
}

/**
 * Returns true when the value is a GraphQLEnumType.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQLEnumType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isEnumType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   enum Episode {
 *     NEW_HOPE
 *     EMPIRE
 *   }
 *
 *   type Query {
 *     favoriteEpisode: Episode
 *   }
 * `);
 *
 * isEnumType(schema.getType('Episode')); // => true
 * isEnumType(schema.getType('Query')); // => false
 * ```
 */
export function isEnumType(type: unknown): type is GraphQLEnumType {
  return instanceOf(type, GraphQLEnumType);
}

/**
 * Returns the value as a GraphQLEnumType, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQLEnumType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertEnumType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   enum Episode {
 *     NEW_HOPE
 *     EMPIRE
 *   }
 *
 *   type Query {
 *     favoriteEpisode: Episode
 *   }
 * `);
 *
 * const episodeType = assertEnumType(schema.getType('Episode'));
 *
 * episodeType.getValues().map((value) => value.name); // => ['NEW_HOPE', 'EMPIRE']
 * assertEnumType(schema.getType('Query')); // throws an error
 * ```
 */
export function assertEnumType(type: unknown): GraphQLEnumType {
  if (!isEnumType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Enum type.`);
  }
  return type;
}

/**
 * Returns true when the value is a GraphQLInputObjectType.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQLInputObjectType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isInputObjectType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type Review {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     review(input: ReviewInput): Review
 *   }
 * `);
 *
 * isInputObjectType(schema.getType('ReviewInput')); // => true
 * isInputObjectType(schema.getType('Review')); // => false
 * ```
 */
export function isInputObjectType(
  type: unknown,
): type is GraphQLInputObjectType {
  return instanceOf(type, GraphQLInputObjectType);
}

/**
 * Returns the value as a GraphQLInputObjectType, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQLInputObjectType.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertInputObjectType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type Review {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     review(input: ReviewInput): Review
 *   }
 * `);
 *
 * const inputType = assertInputObjectType(schema.getType('ReviewInput'));
 *
 * Object.keys(inputType.getFields()); // => ['stars']
 * assertInputObjectType(schema.getType('Review')); // throws an error
 * ```
 */
export function assertInputObjectType(type: unknown): GraphQLInputObjectType {
  if (!isInputObjectType(type)) {
    throw new Error(
      `Expected ${inspect(type)} to be a GraphQL Input Object type.`,
    );
  }
  return type;
}

/**
 * Returns true when the value is a GraphQLList.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQLList.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { GraphQLList, GraphQLString, isListType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     tags: [String!]!
 *   }
 * `);
 *
 * const tagsField = schema.getQueryType()?.getFields().tags;
 *
 * isListType(new GraphQLList(GraphQLString)); // => true
 * isListType(GraphQLString); // => false
 * isListType(tagsField?.type); // => false
 * ```
 */
export function isListType(
  type: GraphQLInputType,
): type is GraphQLList<GraphQLInputType>;
/**
 * Returns true when the output type is a GraphQLList.
 * @param type - The GraphQL output type to inspect.
 * @returns True when the output type is a list type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { getNullableType, isListType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     tags: [String!]!
 *   }
 * `);
 *
 * const tagsField = schema.getQueryType()?.getFields().tags;
 * const nullableTagsType = getNullableType(tagsField?.type);
 *
 * isListType(nullableTagsType); // => true
 * ```
 */
export function isListType(
  type: GraphQLOutputType,
): type is GraphQLList<GraphQLOutputType>;
/**
 * Returns true when the value is a GraphQLList.
 * @param type - The value to inspect.
 * @returns True when the value is a list type.
 * @example
 * ```ts
 * import { isListType } from 'graphql/type';
 *
 * isListType('[String]'); // => false
 * isListType(null); // => false
 * ```
 */
export function isListType(type: unknown): type is GraphQLList<GraphQLType>;
/** @internal */
export function isListType(type: unknown): type is GraphQLList<GraphQLType> {
  return instanceOf(type, GraphQLList);
}

/**
 * Returns the value as a GraphQLList, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQLList.
 * @example
 * ```ts
 * import { GraphQLList, GraphQLString, assertListType } from 'graphql/type';
 *
 * const listType = assertListType(new GraphQLList(GraphQLString));
 *
 * listType.ofType; // => GraphQLString
 * assertListType(GraphQLString); // throws an error
 * ```
 */
export function assertListType(type: unknown): GraphQLList<GraphQLType> {
  if (!isListType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL List type.`);
  }
  return type;
}

/**
 * Returns true when the value is a GraphQLNonNull.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQLNonNull.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { GraphQLNonNull, GraphQLString, isNonNullType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String!
 *     nickname: String
 *   }
 * `);
 *
 * const fields = schema.getQueryType()?.getFields();
 *
 * isNonNullType(new GraphQLNonNull(GraphQLString)); // => true
 * isNonNullType(fields?.name.type); // => true
 * isNonNullType(fields?.nickname.type); // => false
 * ```
 */
export function isNonNullType(
  type: GraphQLInputType,
): type is GraphQLNonNull<GraphQLInputType>;
/**
 * Returns true when the output type is a GraphQLNonNull.
 * @param type - The GraphQL output type to inspect.
 * @returns True when the output type is a non-null type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isNonNullType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String!
 *     nickname: String
 *   }
 * `);
 *
 * const fields = schema.getQueryType()?.getFields();
 *
 * isNonNullType(fields?.name.type); // => true
 * isNonNullType(fields?.nickname.type); // => false
 * ```
 */
export function isNonNullType(
  type: GraphQLOutputType,
): type is GraphQLNonNull<GraphQLOutputType>;
/**
 * Returns true when the value is a GraphQLNonNull.
 * @param type - The value to inspect.
 * @returns True when the value is a non-null type.
 * @example
 * ```ts
 * import { isNonNullType } from 'graphql/type';
 *
 * isNonNullType('String!'); // => false
 * isNonNullType(null); // => false
 * ```
 */
export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLType>;
/** @internal */
export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLType> {
  return instanceOf(type, GraphQLNonNull);
}

/**
 * Returns the value as a GraphQLNonNull, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQLNonNull.
 * @example
 * ```ts
 * import { GraphQLNonNull, GraphQLString, assertNonNullType } from 'graphql/type';
 *
 * const nonNullType = assertNonNullType(new GraphQLNonNull(GraphQLString));
 *
 * nonNullType.ofType; // => GraphQLString
 * assertNonNullType(GraphQLString); // throws an error
 * ```
 */
export function assertNonNullType(type: unknown): GraphQLNonNull<GraphQLType> {
  if (!isNonNullType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Non-Null type.`);
  }
  return type;
}

/** These types may be used as input types for arguments and directives. */
export type GraphQLInputType =
  | GraphQLScalarType
  | GraphQLEnumType
  | GraphQLInputObjectType
  | GraphQLList<GraphQLInputType>
  | GraphQLNonNull<
      | GraphQLScalarType
      | GraphQLEnumType
      | GraphQLInputObjectType
      | GraphQLList<GraphQLInputType>
    >;

/**
 * Returns true when the value can be used as a GraphQL input type.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value can be used as a GraphQL input type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isInputType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type Review {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     review(input: ReviewInput): Review
 *   }
 * `);
 *
 * isInputType(schema.getType('ReviewInput')); // => true
 * isInputType(schema.getType('Review')); // => false
 * ```
 */
export function isInputType(type: unknown): type is GraphQLInputType {
  return (
    isScalarType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    (isWrappingType(type) && isInputType(type.ofType))
  );
}

/**
 * Returns the value as a GraphQL input type, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQL input type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertInputType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type Review {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     review(input: ReviewInput): Review
 *   }
 * `);
 *
 * const inputType = assertInputType(schema.getType('ReviewInput'));
 *
 * inputType.toString(); // => 'ReviewInput'
 * assertInputType(schema.getType('Review')); // throws an error
 * ```
 */
export function assertInputType(type: unknown): GraphQLInputType {
  if (!isInputType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL input type.`);
  }
  return type;
}

/** These types may be used as output types as the result of fields. */
export type GraphQLOutputType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLList<GraphQLOutputType>
  | GraphQLNonNull<
      | GraphQLScalarType
      | GraphQLObjectType
      | GraphQLInterfaceType
      | GraphQLUnionType
      | GraphQLEnumType
      | GraphQLList<GraphQLOutputType>
    >;

/**
 * Returns true when the value can be used as a GraphQL output type.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value can be used as a GraphQL output type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isOutputType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type Review {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     review(input: ReviewInput): Review
 *   }
 * `);
 *
 * isOutputType(schema.getType('Review')); // => true
 * isOutputType(schema.getType('ReviewInput')); // => false
 * ```
 */
export function isOutputType(type: unknown): type is GraphQLOutputType {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    (isWrappingType(type) && isOutputType(type.ofType))
  );
}

/**
 * Returns the value as a GraphQL output type, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQL output type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertOutputType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type Review {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     review(input: ReviewInput): Review
 *   }
 * `);
 *
 * const outputType = assertOutputType(schema.getType('Review'));
 *
 * outputType.toString(); // => 'Review'
 * assertOutputType(schema.getType('ReviewInput')); // throws an error
 * ```
 */
export function assertOutputType(type: unknown): GraphQLOutputType {
  if (!isOutputType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL output type.`);
  }
  return type;
}

/** These types may describe types which may be leaf values. */
export type GraphQLLeafType = GraphQLScalarType | GraphQLEnumType;

/**
 * Returns true when the value is a GraphQL scalar or enum type.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQL scalar or enum type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isLeafType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   enum Episode {
 *     NEW_HOPE
 *   }
 *
 *   type Review {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     episode: Episode
 *     review: Review
 *   }
 * `);
 *
 * isLeafType(schema.getType('Episode')); // => true
 * isLeafType(schema.getType('String')); // => true
 * isLeafType(schema.getType('Review')); // => false
 * ```
 */
export function isLeafType(type: unknown): type is GraphQLLeafType {
  return isScalarType(type) || isEnumType(type);
}

/**
 * Returns the value as a GraphQL leaf type, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQL leaf type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertLeafType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   enum Episode {
 *     NEW_HOPE
 *   }
 *
 *   type Review {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     episode: Episode
 *     review: Review
 *   }
 * `);
 *
 * const episodeType = assertLeafType(schema.getType('Episode'));
 *
 * episodeType.toString(); // => 'Episode'
 * assertLeafType(schema.getType('Review')); // throws an error
 * ```
 */
export function assertLeafType(type: unknown): GraphQLLeafType {
  if (!isLeafType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL leaf type.`);
  }
  return type;
}

/** These types may describe the parent context of a selection set. */
export type GraphQLCompositeType =
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType;

/**
 * Returns true when the value is a GraphQL object, interface, or union type.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQL object, interface, or union type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isCompositeType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   interface Node {
 *     id: ID!
 *   }
 *
 *   type User implements Node {
 *     id: ID!
 *   }
 *
 *   union SearchResult = User
 *
 *   type Query {
 *     node: Node
 *     search: [SearchResult]
 *   }
 * `);
 *
 * isCompositeType(schema.getType('User')); // => true
 * isCompositeType(schema.getType('Node')); // => true
 * isCompositeType(schema.getType('SearchResult')); // => true
 * isCompositeType(schema.getType('String')); // => false
 * ```
 */
export function isCompositeType(type: unknown): type is GraphQLCompositeType {
  return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}

/**
 * Returns the value as a GraphQL composite type, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQL composite type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertCompositeType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   interface Node {
 *     id: ID!
 *   }
 *
 *   type User implements Node {
 *     id: ID!
 *   }
 *
 *   type Query {
 *     node: Node
 *   }
 * `);
 *
 * const userType = assertCompositeType(schema.getType('User'));
 *
 * userType.toString(); // => 'User'
 * assertCompositeType(schema.getType('String')); // throws an error
 * ```
 */
export function assertCompositeType(type: unknown): GraphQLCompositeType {
  if (!isCompositeType(type)) {
    throw new Error(
      `Expected ${inspect(type)} to be a GraphQL composite type.`,
    );
  }
  return type;
}

/** These types may describe the parent context of a selection set. */
export type GraphQLAbstractType = GraphQLInterfaceType | GraphQLUnionType;

/**
 * Returns true when the value is a GraphQL interface or union type.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQL interface or union type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isAbstractType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   interface Node {
 *     id: ID!
 *   }
 *
 *   type User implements Node {
 *     id: ID!
 *   }
 *
 *   union SearchResult = User
 *
 *   type Query {
 *     node: Node
 *     search: [SearchResult]
 *   }
 * `);
 *
 * isAbstractType(schema.getType('Node')); // => true
 * isAbstractType(schema.getType('SearchResult')); // => true
 * isAbstractType(schema.getType('User')); // => false
 * ```
 */
export function isAbstractType(type: unknown): type is GraphQLAbstractType {
  return isInterfaceType(type) || isUnionType(type);
}

/**
 * Returns the value as a GraphQL abstract type, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQL abstract type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertAbstractType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   interface Node {
 *     id: ID!
 *   }
 *
 *   type User implements Node {
 *     id: ID!
 *   }
 *
 *   type Query {
 *     node: Node
 *   }
 * `);
 *
 * const nodeType = assertAbstractType(schema.getType('Node'));
 *
 * nodeType.toString(); // => 'Node'
 * assertAbstractType(schema.getType('User')); // throws an error
 * ```
 */
export function assertAbstractType(type: unknown): GraphQLAbstractType {
  if (!isAbstractType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL abstract type.`);
  }
  return type;
}

/**
 * List Type Wrapper
 *
 * A list is a wrapping type which points to another type.
 * Lists are often created within the context of defining the fields of
 * an object type.
 * @typeParam T - The GraphQL type wrapped by this list type.
 * @example
 * ```ts
 * const PersonType = new GraphQLObjectType({
 *   name: 'Person',
 *   fields: () => ({
 *     parents: { type: new GraphQLList(PersonType) },
 *     children: { type: new GraphQLList(PersonType) },
 *   })
 * })
 * ```
 */
export class GraphQLList<T extends GraphQLType> {
  /** The type wrapped by this list or non-null type. */
  readonly ofType: T;

  /**
   * Creates a GraphQLList instance.
   * @param ofType - The type to wrap.
   * @example
   * ```ts
   * import { GraphQLList, GraphQLString } from 'graphql/type';
   *
   * const stringList = new GraphQLList(GraphQLString);
   *
   * stringList.ofType; // => GraphQLString
   * String(stringList); // => '[String]'
   * ```
   */
  constructor(ofType: T) {
    devAssert(
      isType(ofType),
      `Expected ${inspect(ofType)} to be a GraphQL type.`,
    );

    this.ofType = ofType;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag]() {
    return 'GraphQLList';
  }

  /**
   * Returns this wrapping type as a GraphQL type-reference string.
   * @returns The GraphQL type-reference string.
   * @example
   * ```ts
   * import { GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql/type';
   *
   * const stringList = new GraphQLList(GraphQLString);
   * const requiredStringList = new GraphQLList(new GraphQLNonNull(GraphQLString));
   *
   * stringList.toString(); // => '[String]'
   * requiredStringList.toString(); // => '[String!]'
   * ```
   */
  toString(): string {
    return '[' + String(this.ofType) + ']';
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { GraphQLList, GraphQLString } from 'graphql/type';
   *
   * const stringList = new GraphQLList(GraphQLString);
   *
   * stringList.toJSON(); // => '[String]'
   * JSON.stringify({ type: stringList }); // => '{"type":"[String]"}'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

/**
 * Non-Null Type Wrapper
 *
 * A non-null is a wrapping type which points to another type.
 * Non-null types enforce that their values are never null and can ensure
 * an error is raised if this ever occurs during a request. It is useful for
 * fields which you can make a strong guarantee on non-nullability, for example
 * usually the id field of a database row will never be null.
 * @typeParam T - The nullable GraphQL type wrapped by this non-null type.
 * @example
 * ```ts
 * const RowType = new GraphQLObjectType({
 *   name: 'Row',
 *   fields: () => ({
 *     id: { type: new GraphQLNonNull(GraphQLString) },
 *   })
 * })
 * ```
 *
 * Note: the enforcement of non-nullability occurs within the executor.
 */
export class GraphQLNonNull<T extends GraphQLNullableType> {
  /** The type wrapped by this list or non-null type. */
  readonly ofType: T;

  /**
   * Creates a GraphQLNonNull instance.
   * @param ofType - The type to wrap.
   * @example
   * ```ts
   * import { GraphQLNonNull, GraphQLString } from 'graphql/type';
   *
   * const requiredString = new GraphQLNonNull(GraphQLString);
   *
   * requiredString.ofType; // => GraphQLString
   * String(requiredString); // => 'String!'
   * ```
   */
  constructor(ofType: T) {
    devAssert(
      isNullableType(ofType),
      `Expected ${inspect(ofType)} to be a GraphQL nullable type.`,
    );

    this.ofType = ofType;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag]() {
    return 'GraphQLNonNull';
  }

  /**
   * Returns this wrapping type as a GraphQL type-reference string.
   * @returns The GraphQL type-reference string.
   * @example
   * ```ts
   * import { GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql/type';
   *
   * const requiredString = new GraphQLNonNull(GraphQLString);
   * const requiredStringList = new GraphQLNonNull(
   *   new GraphQLList(GraphQLString),
   * );
   *
   * requiredString.toString(); // => 'String!'
   * requiredStringList.toString(); // => '[String]!'
   * ```
   */
  toString(): string {
    return String(this.ofType) + '!';
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { GraphQLNonNull, GraphQLString } from 'graphql/type';
   *
   * const requiredString = new GraphQLNonNull(GraphQLString);
   *
   * requiredString.toJSON(); // => 'String!'
   * JSON.stringify({ type: requiredString }); // => '{"type":"String!"}'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

/** These types wrap and modify other types */
export type GraphQLWrappingType =
  | GraphQLList<GraphQLType>
  | GraphQLNonNull<GraphQLType>;

/**
 * Returns true when the value is a GraphQL list or non-null wrapper type.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQL list or non-null wrapper type.
 * @example
 * ```ts
 * import {
 *   GraphQLList,
 *   GraphQLNonNull,
 *   GraphQLString,
 *   isWrappingType,
 * } from 'graphql/type';
 *
 * isWrappingType(new GraphQLList(GraphQLString)); // => true
 * isWrappingType(new GraphQLNonNull(GraphQLString)); // => true
 * isWrappingType(GraphQLString); // => false
 * ```
 */
export function isWrappingType(type: unknown): type is GraphQLWrappingType {
  return isListType(type) || isNonNullType(type);
}

/**
 * Returns the value as a GraphQL wrapping type, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQL wrapping type.
 * @example
 * ```ts
 * import { GraphQLList, GraphQLString, assertWrappingType } from 'graphql/type';
 *
 * const wrappingType = assertWrappingType(new GraphQLList(GraphQLString));
 *
 * wrappingType.toString(); // => '[String]'
 * assertWrappingType(GraphQLString); // throws an error
 * ```
 */
export function assertWrappingType(type: unknown): GraphQLWrappingType {
  if (!isWrappingType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL wrapping type.`);
  }
  return type;
}

/** These types can all accept null as a value. */
export type GraphQLNullableType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLInputObjectType
  | GraphQLList<GraphQLType>;

/**
 * Returns true when the value is a GraphQL type that can accept null.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQL type that can accept null.
 * @example
 * ```ts
 * import { GraphQLNonNull, GraphQLString, isNullableType } from 'graphql/type';
 *
 * isNullableType(GraphQLString); // => true
 * isNullableType(new GraphQLNonNull(GraphQLString)); // => false
 * isNullableType(null); // => false
 * ```
 */
export function isNullableType(type: unknown): type is GraphQLNullableType {
  return isType(type) && !isNonNullType(type);
}

/**
 * Returns the value as a nullable GraphQL type, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a nullable GraphQL type.
 * @example
 * ```ts
 * import {
 *   GraphQLNonNull,
 *   GraphQLString,
 *   assertNullableType,
 * } from 'graphql/type';
 *
 * const nullableType = assertNullableType(GraphQLString);
 *
 * nullableType; // => GraphQLString
 * assertNullableType(new GraphQLNonNull(GraphQLString)); // throws an error
 * ```
 */
export function assertNullableType(type: unknown): GraphQLNullableType {
  if (!isNullableType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL nullable type.`);
  }
  return type;
}

/**
 * Returns the nullable type.
 * @param type - The GraphQL type to inspect.
 * @returns The nullable type after removing one non-null wrapper, if present.
 * @example
 * ```ts
 * import { getNullableType } from 'graphql/type';
 *
 * getNullableType(null); // => undefined
 * getNullableType(undefined); // => undefined
 * ```
 */
export function getNullableType(type: undefined | null): void;
/**
 * Returns the nullable type after removing one non-null wrapper.
 * @param type - A nullable type or non-null wrapper.
 * @returns The nullable type after removing one non-null wrapper, if present.
 * @typeParam T - The nullable GraphQL type returned after removing one non-null wrapper.
 * @example
 * ```ts
 * import {
 *   GraphQLList,
 *   GraphQLNonNull,
 *   GraphQLString,
 *   getNullableType,
 * } from 'graphql/type';
 *
 * const requiredString = new GraphQLNonNull(GraphQLString);
 * const stringList = new GraphQLList(GraphQLString);
 *
 * getNullableType(requiredString); // => GraphQLString
 * getNullableType(stringList); // => stringList
 * ```
 */
export function getNullableType<T extends GraphQLNullableType>(
  type: T | GraphQLNonNull<T>,
): T;
/**
 * Returns the nullable type after removing one non-null wrapper.
 * @param type - The GraphQL type to inspect.
 * @returns The nullable type after removing one non-null wrapper, if present.
 * @example
 * ```ts
 * import {
 *   GraphQLList,
 *   GraphQLNonNull,
 *   GraphQLString,
 *   getNullableType,
 * } from 'graphql/type';
 *
 * const requiredStringList = new GraphQLNonNull(
 *   new GraphQLList(GraphQLString),
 * );
 *
 * getNullableType(requiredStringList).toString(); // => '[String]'
 * getNullableType(GraphQLString); // => GraphQLString
 * ```
 */
export function getNullableType(
  type: Maybe<GraphQLType>,
): GraphQLNullableType | undefined;
/** @internal */
export function getNullableType(
  type: Maybe<GraphQLType>,
): GraphQLNullableType | undefined {
  if (type) {
    return isNonNullType(type) ? type.ofType : type;
  }
}

/** These named types do not include modifiers like List or NonNull. */
export type GraphQLNamedType = GraphQLNamedInputType | GraphQLNamedOutputType;

/** A named GraphQL type that can be used as an input type. */
export type GraphQLNamedInputType =
  | GraphQLScalarType
  | GraphQLEnumType
  | GraphQLInputObjectType;

/** A named GraphQL type that can be used as an output type. */
export type GraphQLNamedOutputType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType;

/**
 * Returns true when the value is a GraphQL named type.
 * @param type - The GraphQL type to inspect.
 * @returns True when the value is a GraphQL named type.
 * @example
 * ```ts
 * import { GraphQLList, GraphQLString, isNamedType } from 'graphql/type';
 *
 * isNamedType(GraphQLString); // => true
 * isNamedType(new GraphQLList(GraphQLString)); // => false
 * isNamedType(null); // => false
 * ```
 */
export function isNamedType(type: unknown): type is GraphQLNamedType {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    isInputObjectType(type)
  );
}

/**
 * Returns the value as a GraphQL named type, or throws if it is not one.
 * @param type - The GraphQL type to inspect.
 * @returns The value typed as a GraphQL named type.
 * @example
 * ```ts
 * import { GraphQLList, GraphQLString, assertNamedType } from 'graphql/type';
 *
 * const namedType = assertNamedType(GraphQLString);
 *
 * namedType.name; // => 'String'
 * assertNamedType(new GraphQLList(GraphQLString)); // throws an error
 * ```
 */
export function assertNamedType(type: unknown): GraphQLNamedType {
  if (!isNamedType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL named type.`);
  }
  return type;
}

/**
 * Returns the named type.
 * @param type - The GraphQL type to inspect.
 * @returns The named type after unwrapping all list and non-null wrappers.
 * @example
 * ```ts
 * import { getNamedType } from 'graphql/type';
 *
 * getNamedType(null); // => undefined
 * getNamedType(undefined); // => undefined
 * ```
 */
export function getNamedType(type: undefined | null): void;
/**
 * Returns the named input type after unwrapping all list and non-null wrappers.
 * @param type - The GraphQL input type to inspect.
 * @returns The named input type after unwrapping all wrappers.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { getNamedType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     review(input: [ReviewInput!]!): Boolean
 *   }
 * `);
 *
 * const inputArg = schema.getQueryType()?.getFields().review.args[0];
 *
 * getNamedType(inputArg?.type).toString(); // => 'ReviewInput'
 * ```
 */
export function getNamedType(type: GraphQLInputType): GraphQLNamedInputType;
/**
 * Returns the named output type after unwrapping all list and non-null wrappers.
 * @param type - The GraphQL output type to inspect.
 * @returns The named output type after unwrapping all wrappers.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { getNamedType } from 'graphql/type';
 *
 * const schema = buildSchema(`
 *   type User {
 *     name: String
 *   }
 *
 *   type Query {
 *     users: [User!]!
 *   }
 * `);
 *
 * const usersField = schema.getQueryType()?.getFields().users;
 *
 * getNamedType(usersField?.type).toString(); // => 'User'
 * ```
 */
export function getNamedType(type: GraphQLOutputType): GraphQLNamedOutputType;
/**
 * Returns the named type after unwrapping all list and non-null wrappers.
 * @param type - The GraphQL type to inspect.
 * @returns The named type after unwrapping all wrappers.
 * @example
 * ```ts
 * import {
 *   GraphQLList,
 *   GraphQLNonNull,
 *   GraphQLString,
 *   getNamedType,
 * } from 'graphql/type';
 *
 * const nestedType = new GraphQLNonNull(
 *   new GraphQLList(new GraphQLNonNull(GraphQLString)),
 * );
 *
 * getNamedType(nestedType); // => GraphQLString
 * ```
 */
export function getNamedType(type: GraphQLType): GraphQLNamedType;
/**
 * Returns the named type after unwrapping all list and non-null wrappers.
 * @param type - The GraphQL type to inspect.
 * @returns The named type after unwrapping all wrappers, or undefined for nullish input.
 * @example
 * ```ts
 * import {
 *   GraphQLList,
 *   GraphQLString,
 *   getNamedType,
 * } from 'graphql/type';
 *
 * getNamedType(new GraphQLList(GraphQLString)); // => GraphQLString
 * getNamedType(undefined); // => undefined
 * ```
 */
export function getNamedType(
  type: Maybe<GraphQLType>,
): GraphQLNamedType | undefined;
/** @internal */
export function getNamedType(
  type: Maybe<GraphQLType>,
): GraphQLNamedType | undefined {
  if (type) {
    let unwrappedType = type;
    while (isWrappingType(unwrappedType)) {
      unwrappedType = unwrappedType.ofType;
    }
    return unwrappedType;
  }
}

/**
 * Used while defining GraphQL types to allow for circular references in
 * otherwise immutable type definitions.
 * @typeParam T - The element type returned by the thunk or array.
 */
export type ThunkReadonlyArray<T> = (() => ReadonlyArray<T>) | ReadonlyArray<T>;
/**
 * A thunk that resolves to an object map.
 * @typeParam T - Value type stored in the object map.
 */
export type ThunkObjMap<T> = (() => ObjMap<T>) | ObjMap<T>;

/**
 * Resolves a thunked readonly array.
 * @param thunk - The thunk or value to resolve.
 * @returns The resolved readonly array.
 * @typeParam T - The element type resolved from the thunk or array.
 * @example
 * ```ts
 * import { GraphQLString, resolveReadonlyArrayThunk } from 'graphql/type';
 *
 * const lazyFields = resolveReadonlyArrayThunk(() => [GraphQLString]);
 * const fields = resolveReadonlyArrayThunk([GraphQLString]);
 *
 * lazyFields; // => [GraphQLString]
 * fields; // => [GraphQLString]
 * ```
 */
export function resolveReadonlyArrayThunk<T>(
  thunk: ThunkReadonlyArray<T>,
): ReadonlyArray<T> {
  return typeof thunk === 'function' ? thunk() : thunk;
}

/**
 * Resolves a thunked object map.
 * @param thunk - The thunk or value to resolve.
 * @returns The resolved object map.
 * @typeParam T - The object-map value type resolved from the thunk or map.
 * @example
 * ```ts
 * import { GraphQLString, resolveObjMapThunk } from 'graphql/type';
 *
 * const lazyFields = resolveObjMapThunk(() => ({ name: GraphQLString }));
 * const fields = resolveObjMapThunk({ name: GraphQLString });
 *
 * lazyFields.name; // => GraphQLString
 * fields.name; // => GraphQLString
 * ```
 */
export function resolveObjMapThunk<T>(thunk: ThunkObjMap<T>): ObjMap<T> {
  return typeof thunk === 'function' ? thunk() : thunk;
}

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLScalarTypeExtensions {
  [attributeName: string]: unknown;
}

/**
 * Scalar Type Definition
 *
 * Scalar types define the leaf values of a GraphQL response and the input
 * values accepted by arguments and input object fields. A scalar type has a
 * name and coercion functions that validate and convert runtime values and
 * GraphQL literals.
 *
 * If a type's serialize function returns `null` or does not return a value
 * (i.e. it returns `undefined`) then an error will be raised and a `null`
 * value will be returned in the response. Prefer validating inputs before
 * execution so clients receive input diagnostics before result coercion fails.
 * @typeParam TInternal - The internal runtime representation accepted by this scalar.
 * @typeParam TExternal - The serialized representation exposed in GraphQL results.
 * @example
 * ```ts
 * const OddType = new GraphQLScalarType({
 *   name: 'Odd',
 *   serialize: (value) => {
 *     if (!Number.isFinite(value)) {
 *       throw new Error(
 *         `Scalar "Odd" cannot represent "${value}" since it is not a finite number.`,
 *       );
 *     }
 *
 *     if (value % 2 === 0) {
 *       throw new Error(`Scalar "Odd" cannot represent "${value}" since it is even.`);
 *     }
 *     return value;
 *   }
 * });
 * ```
 */
export class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** URL identifying the behavior specified for this custom scalar. */
  specifiedByURL: Maybe<string>;
  /** Function that converts internal values to externally visible scalar values. */
  serialize: GraphQLScalarSerializer<TExternal>;
  /** Function that converts variable input into this scalar's internal value. */
  parseValue: GraphQLScalarValueParser<TInternal>;
  /** Function that converts AST input literals into this scalar's internal value. */
  parseLiteral: GraphQLScalarLiteralParser<TInternal>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLScalarTypeExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<ScalarTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes: ReadonlyArray<ScalarTypeExtensionNode>;

  /**
   * Creates a GraphQLScalarType instance.
   * @param config - Configuration describing this object.
   * @example
   * ```ts
   * import { Kind, parse } from 'graphql/language';
   * import { GraphQLScalarType } from 'graphql/type';
   *
   * const document = parse(`
   *   "Odd integer values."
   *   scalar Odd @specifiedBy(url: "https://example.com/odd")
   *
   *   extend scalar Odd @specifiedBy(url: "https://example.com/odd-v2")
   * `);
   *
   * const Odd = new GraphQLScalarType({
   *   name: 'Odd',
   *   description: 'Odd integer values.',
   *   specifiedByURL: 'https://example.com/odd',
   *   serialize: (value) => {
   *     if (typeof value !== 'number' || value % 2 === 0) {
   *       throw new TypeError('Odd can only serialize odd numbers.');
   *     }
   *     return value;
   *   },
   *   parseValue: (value) => {
   *     if (typeof value !== 'number' || value % 2 === 0) {
   *       throw new TypeError('Odd can only parse odd numbers.');
   *     }
   *     return value;
   *   },
   *   parseLiteral: (ast) => {
   *     if (ast.kind !== Kind.INT) {
   *       throw new TypeError('Odd can only parse integer literals.');
   *     }
   *     const value = Number(ast.value);
   *     if (value % 2 === 0) {
   *       throw new TypeError('Odd can only parse odd integer literals.');
   *     }
   *     return value;
   *   },
   *   extensions: { numeric: true },
   *   astNode: document.definitions[0],
   *   extensionASTNodes: [ document.definitions[1] ],
   * });
   *
   * Odd.description; // => 'Odd integer values.'
   * Odd.specifiedByURL; // => 'https://example.com/odd'
   * Odd.serialize(3); // => 3
   * Odd.parseValue(5); // => 5
   * Odd.extensions; // => { numeric: true }
   * ```
   */
  constructor(config: Readonly<GraphQLScalarTypeConfig<TInternal, TExternal>>) {
    const parseValue =
      config.parseValue ??
      (identityFunc as GraphQLScalarValueParser<TInternal>);

    this.name = assertName(config.name);
    this.description = config.description;
    this.specifiedByURL = config.specifiedByURL;
    this.serialize =
      config.serialize ?? (identityFunc as GraphQLScalarSerializer<TExternal>);
    this.parseValue = parseValue;
    this.parseLiteral =
      config.parseLiteral ??
      ((node, variables) => parseValue(valueFromASTUntyped(node, variables)));
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    devAssert(
      config.specifiedByURL == null ||
        typeof config.specifiedByURL === 'string',
      `${this.name} must provide "specifiedByURL" as a string, ` +
        `but got: ${inspect(config.specifiedByURL)}.`,
    );

    devAssert(
      config.serialize == null || typeof config.serialize === 'function',
      `${this.name} must provide "serialize" function. If this custom Scalar is also used as an input type, ensure "parseValue" and "parseLiteral" functions are also provided.`,
    );

    if (config.parseLiteral) {
      devAssert(
        typeof config.parseValue === 'function' &&
          typeof config.parseLiteral === 'function',
        `${this.name} must provide both "parseValue" and "parseLiteral" functions.`,
      );
    }
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag]() {
    return 'GraphQLScalarType';
  }

  /**
   * Returns a normalized configuration object for this object.
   * @returns A configuration object that can be used to recreate this object.
   * @example
   * ```ts
   * import { GraphQLScalarType } from 'graphql/type';
   *
   * const Url = new GraphQLScalarType({
   *   name: 'Url',
   *   description: 'An absolute URL string.',
   *   specifiedByURL: 'https://url.spec.whatwg.org/',
   * });
   *
   * const config = Url.toConfig();
   * const UrlCopy = new GraphQLScalarType(config);
   *
   * config.name; // => 'Url'
   * config.specifiedByURL; // => 'https://url.spec.whatwg.org/'
   * UrlCopy.name; // => Url.name
   * ```
   */
  toConfig(): GraphQLScalarTypeNormalizedConfig<TInternal, TExternal> {
    return {
      name: this.name,
      description: this.description,
      specifiedByURL: this.specifiedByURL,
      serialize: this.serialize,
      parseValue: this.parseValue,
      parseLiteral: this.parseLiteral,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  /**
   * Returns the schema coordinate identifying this scalar type.
   * @returns The schema coordinate for this scalar type.
   * @example
   * ```ts
   * import { GraphQLScalarType } from 'graphql/type';
   *
   * const DateTime = new GraphQLScalarType({ name: 'DateTime' });
   *
   * DateTime.toString(); // => 'DateTime'
   * String(DateTime); // => 'DateTime'
   * ```
   */
  toString(): string {
    return this.name;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { GraphQLScalarType } from 'graphql/type';
   *
   * const DateTime = new GraphQLScalarType({ name: 'DateTime' });
   *
   * DateTime.toJSON(); // => 'DateTime'
   * JSON.stringify({ type: DateTime }); // => '{"type":"DateTime"}'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

/**
 * Serializes a runtime value as a scalar output value.
 * @typeParam TExternal - The serialized representation returned for GraphQL results.
 */
export type GraphQLScalarSerializer<TExternal> = (
  outputValue: unknown,
) => TExternal;

/**
 * Parses a runtime input value as a scalar input value.
 * @typeParam TInternal - The internal runtime representation produced from variable input.
 */
export type GraphQLScalarValueParser<TInternal> = (
  inputValue: unknown,
) => TInternal;

/**
 * Parses a GraphQL value literal as a scalar input value.
 * @typeParam TInternal - The internal runtime representation produced from literal input.
 */
export type GraphQLScalarLiteralParser<TInternal> = (
  valueNode: ValueNode,
  variables?: Maybe<ObjMap<unknown>>,
) => TInternal;

/**
 * Configuration used to construct a GraphQLScalarType.
 * @typeParam TInternal - The internal runtime representation accepted by this scalar.
 * @typeParam TExternal - The serialized representation exposed in GraphQL results.
 */
export interface GraphQLScalarTypeConfig<TInternal, TExternal> {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** URL identifying the behavior specified for this custom scalar. */
  specifiedByURL?: Maybe<string>;
  /** Serializes an internal value to include in a response. */
  serialize?: GraphQLScalarSerializer<TExternal>;
  /** Parses an externally provided value to use as an input. */
  parseValue?: GraphQLScalarValueParser<TInternal>;
  /** Parses an externally provided literal value to use as an input. */
  parseLiteral?: GraphQLScalarLiteralParser<TInternal>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<Readonly<GraphQLScalarTypeExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<ScalarTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<ScalarTypeExtensionNode>>;
}

interface GraphQLScalarTypeNormalizedConfig<TInternal, TExternal>
  extends GraphQLScalarTypeConfig<TInternal, TExternal> {
  serialize: GraphQLScalarSerializer<TExternal>;
  parseValue: GraphQLScalarValueParser<TInternal>;
  parseLiteral: GraphQLScalarLiteralParser<TInternal>;
  extensions: Readonly<GraphQLScalarTypeExtensions>;
  extensionASTNodes: ReadonlyArray<ScalarTypeExtensionNode>;
}

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 * We've provided these template arguments because this is an open type and
 * you may find them useful.
 * @typeParam _TSource - Reserved source type parameter for extension typing.
 * @typeParam _TContext - Reserved context type parameter for extension typing.
 */
export interface GraphQLObjectTypeExtensions<_TSource = any, _TContext = any> {
  [attributeName: string]: unknown;
}

/**
 * Object Type Definition
 *
 * Almost all of the GraphQL types you define will be object types. Object types
 * have a name, but most importantly describe their fields.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 * @example
 * ```ts
 * const AddressType = new GraphQLObjectType({
 *   name: 'Address',
 *   fields: {
 *     street: { type: GraphQLString },
 *     number: { type: GraphQLInt },
 *     formatted: {
 *       type: GraphQLString,
 *       resolve: (obj) => {
 *         return obj.number + ' ' + obj.street
 *       }
 *     }
 *   }
 * });
 * ```
 * @example
 * When two types need to refer to each other, or a type needs to refer to
 * itself in a field, you can use a function expression (aka a closure or a
 * thunk) to supply the fields lazily.
 *
 * ```ts
 * const PersonType = new GraphQLObjectType({
 *   name: 'Person',
 *   fields: () => ({
 *     name: { type: GraphQLString },
 *     bestFriend: { type: PersonType },
 *   })
 * });
 * ```
 */
export class GraphQLObjectType<TSource = any, TContext = any> {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Predicate used to determine whether a runtime value belongs to this object type. */
  isTypeOf: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<ObjectTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes: ReadonlyArray<ObjectTypeExtensionNode>;

  private _fields: ThunkObjMap<GraphQLField<TSource, TContext>>;
  private _interfaces: ThunkReadonlyArray<GraphQLInterfaceType>;

  /**
   * Creates a GraphQLObjectType instance.
   * @param config - Configuration describing this object.
   * @example
   * ```ts
   * // Configure an object type with interfaces, fields, arguments, and metadata.
   * import { parse } from 'graphql/language';
   * import {
   *   GraphQLID,
   *   GraphQLInterfaceType,
   *   GraphQLNonNull,
   *   GraphQLObjectType,
   *   GraphQLString,
   * } from 'graphql/type';
   *
   * const document = parse(`
   *   type User implements Node {
   *     id: ID!
   *     name(format: String = "short"): String
   *   }
   *
   *   extend type User {
   *     displayName: String
   *   }
   * `);
   * const definition = document.definitions[0];
   * const nameField = definition.fields[1];
   * const formatArg = nameField.arguments[0];
   *
   * const Node = new GraphQLInterfaceType({
   *   name: 'Node',
   *   fields: {
   *     id: { type: new GraphQLNonNull(GraphQLID) },
   *   },
   * });
   *
   * const User = new GraphQLObjectType({
   *   name: 'User',
   *   description: 'A registered user.',
   *   interfaces: [Node],
   *   fields: {
   *     id: { type: new GraphQLNonNull(GraphQLID) },
   *     name: {
   *       description: 'The formatted user name.',
   *       type: GraphQLString,
   *       args: {
   *         format: {
   *           description: 'Controls the name format.',
   *           type: GraphQLString,
   *           defaultValue: 'short',
   *           deprecationReason: 'Use locale instead.',
   *           extensions: { public: true },
   *           astNode: formatArg,
   *         },
   *       },
   *       resolve: (user, { format }) => {
   *         return format === 'long' ? user.fullName : user.name;
   *       },
   *       deprecationReason: 'Use displayName.',
   *       extensions: { cacheSeconds: 60 },
   *       astNode: nameField,
   *     },
   *   },
   *   isTypeOf: (value) => {
   *     return typeof value === 'object' && value != null && 'id' in value;
   *   },
   *   extensions: { entity: 'User' },
   *   astNode: definition,
   *   extensionASTNodes: [ document.definitions[1] ],
   * });
   *
   * User.name; // => 'User'
   * User.getInterfaces(); // => [Node]
   * Object.keys(User.getFields()); // => ['id', 'name']
   * User.getFields().name.args[0].defaultValue; // => 'short'
   * User.extensions; // => { entity: 'User' }
   * ```
   * @example
   * ```ts
   * // This variant configures a subscription field with subscribe and resolve functions.
   * import { GraphQLObjectType, GraphQLString } from 'graphql/type';
   *
   * const Subscription = new GraphQLObjectType({
   *   name: 'Subscription',
   *   fields: {
   *     greeting: {
   *       type: GraphQLString,
   *       subscribe: async function* () {
   *         yield { greeting: 'Hello!' };
   *       },
   *       resolve: (event) => {
   *         return event.greeting;
   *       },
   *     },
   *   },
   * });
   *
   * typeof Subscription.getFields().greeting.subscribe; // => 'function'
   * ```
   */
  constructor(config: Readonly<GraphQLObjectTypeConfig<TSource, TContext>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.isTypeOf = config.isTypeOf;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._fields = () => defineFieldMap(config);
    this._interfaces = () => defineInterfaces(config);
    devAssert(
      config.isTypeOf == null || typeof config.isTypeOf === 'function',
      `${this.name} must provide "isTypeOf" as a function, ` +
        `but got: ${inspect(config.isTypeOf)}.`,
    );
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag]() {
    return 'GraphQLObjectType';
  }

  /**
   * Returns the fields defined by this type.
   * @returns The fields keyed by field name.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertObjectType } from 'graphql/type';
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
   * const User = assertObjectType(schema.getType('User'));
   * const fields = User.getFields();
   *
   * Object.keys(fields); // => ['id', 'name']
   * String(fields.id.type); // => 'ID!'
   * ```
   */
  getFields(): GraphQLFieldMap<TSource, TContext> {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  /**
   * Returns the interfaces implemented by this type.
   * @returns The implemented interfaces.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertObjectType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   interface Node {
   *     id: ID!
   *   }
   *
   *   type User implements Node {
   *     id: ID!
   *   }
   *
   *   type Query {
   *     viewer: User
   *   }
   * `);
   *
   * const User = assertObjectType(schema.getType('User'));
   *
   * User.getInterfaces().map((type) => type.name); // => ['Node']
   * ```
   */
  getInterfaces(): ReadonlyArray<GraphQLInterfaceType> {
    if (typeof this._interfaces === 'function') {
      this._interfaces = this._interfaces();
    }
    return this._interfaces;
  }

  /**
   * Returns a normalized configuration object for this object.
   * @returns A configuration object that can be used to recreate this object.
   * @example
   * ```ts
   * import { GraphQLObjectType, GraphQLString } from 'graphql/type';
   *
   * const User = new GraphQLObjectType({
   *   name: 'User',
   *   fields: {
   *     name: { type: GraphQLString },
   *   },
   * });
   *
   * const config = User.toConfig();
   * const UserCopy = new GraphQLObjectType(config);
   *
   * config.fields.name.type; // => GraphQLString
   * UserCopy.getFields().name.type; // => GraphQLString
   * ```
   */
  toConfig(): GraphQLObjectTypeNormalizedConfig<TSource, TContext> {
    return {
      name: this.name,
      description: this.description,
      interfaces: this.getInterfaces(),
      fields: fieldsToFieldsConfig(this.getFields()),
      isTypeOf: this.isTypeOf,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  /**
   * Returns the schema coordinate identifying this object type.
   * @returns The schema coordinate for this object type.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertObjectType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   type User {
   *     name: String
   *   }
   *
   *   type Query {
   *     viewer: User
   *   }
   * `);
   *
   * const User = assertObjectType(schema.getType('User'));
   *
   * User.toString(); // => 'User'
   * ```
   */
  toString(): string {
    return this.name;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { GraphQLObjectType, GraphQLString } from 'graphql/type';
   *
   * const User = new GraphQLObjectType({
   *   name: 'User',
   *   fields: { name: { type: GraphQLString } },
   * });
   *
   * User.toJSON(); // => 'User'
   * JSON.stringify({ type: User }); // => '{"type":"User"}'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

function defineInterfaces(
  config: Readonly<
    GraphQLObjectTypeConfig<any, any> | GraphQLInterfaceTypeConfig<any, any>
  >,
): ReadonlyArray<GraphQLInterfaceType> {
  const interfaces = resolveReadonlyArrayThunk(config.interfaces ?? []);
  devAssert(
    Array.isArray(interfaces),
    `${config.name} interfaces must be an Array or a function which returns an Array.`,
  );
  return interfaces;
}

function defineFieldMap<TSource, TContext>(
  config: Readonly<
    | GraphQLObjectTypeConfig<TSource, TContext>
    | GraphQLInterfaceTypeConfig<TSource, TContext>
  >,
): GraphQLFieldMap<TSource, TContext> {
  const fieldMap = resolveObjMapThunk(config.fields);
  devAssert(
    isPlainObj(fieldMap),
    `${config.name} fields must be an object with field names as keys or a function which returns such an object.`,
  );

  return mapValue(fieldMap, (fieldConfig, fieldName) => {
    devAssert(
      isPlainObj(fieldConfig),
      `${config.name}.${fieldName} field config must be an object.`,
    );
    devAssert(
      fieldConfig.resolve == null || typeof fieldConfig.resolve === 'function',
      `${config.name}.${fieldName} field resolver must be a function if ` +
        `provided, but got: ${inspect(fieldConfig.resolve)}.`,
    );

    const argsConfig = fieldConfig.args ?? {};
    devAssert(
      isPlainObj(argsConfig),
      `${config.name}.${fieldName} args must be an object with argument names as keys.`,
    );

    return {
      name: assertName(fieldName),
      description: fieldConfig.description,
      type: fieldConfig.type,
      args: defineArguments(argsConfig),
      resolve: fieldConfig.resolve,
      subscribe: fieldConfig.subscribe,
      deprecationReason: fieldConfig.deprecationReason,
      extensions: toObjMap(fieldConfig.extensions),
      astNode: fieldConfig.astNode,
    };
  });
}

/** @internal */
export function defineArguments(
  config: GraphQLFieldConfigArgumentMap,
): ReadonlyArray<GraphQLArgument> {
  return Object.entries(config).map(([argName, argConfig]) => ({
    name: assertName(argName),
    description: argConfig.description,
    type: argConfig.type,
    defaultValue: argConfig.defaultValue,
    deprecationReason: argConfig.deprecationReason,
    extensions: toObjMap(argConfig.extensions),
    astNode: argConfig.astNode,
  }));
}

function isPlainObj(obj: unknown): boolean {
  return isObjectLike(obj) && !Array.isArray(obj);
}

function fieldsToFieldsConfig<TSource, TContext>(
  fields: GraphQLFieldMap<TSource, TContext>,
): GraphQLFieldConfigMap<TSource, TContext> {
  return mapValue(fields, (field) => ({
    description: field.description,
    type: field.type,
    args: argsToArgsConfig(field.args),
    resolve: field.resolve,
    subscribe: field.subscribe,
    deprecationReason: field.deprecationReason,
    extensions: field.extensions,
    astNode: field.astNode,
  }));
}

/** @internal */
export function argsToArgsConfig(
  args: ReadonlyArray<GraphQLArgument>,
): GraphQLFieldConfigArgumentMap {
  return keyValMap(
    args,
    (arg) => arg.name,
    (arg) => ({
      description: arg.description,
      type: arg.type,
      defaultValue: arg.defaultValue,
      deprecationReason: arg.deprecationReason,
      extensions: arg.extensions,
      astNode: arg.astNode,
    }),
  );
}

/**
 * Configuration used to construct a GraphQLObjectType.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export interface GraphQLObjectTypeConfig<TSource, TContext> {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Interfaces implemented by this object or interface type. */
  interfaces?: ThunkReadonlyArray<GraphQLInterfaceType>;
  /** Fields declared by this object, interface, input object, or literal. */
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  /** Predicate used to determine whether a runtime value belongs to this object type. */
  isTypeOf?: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<ObjectTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<ObjectTypeExtensionNode>>;
}

interface GraphQLObjectTypeNormalizedConfig<TSource, TContext>
  extends GraphQLObjectTypeConfig<any, any> {
  interfaces: ReadonlyArray<GraphQLInterfaceType>;
  fields: GraphQLFieldConfigMap<any, any>;
  extensions: Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>;
  extensionASTNodes: ReadonlyArray<ObjectTypeExtensionNode>;
}

/**
 * Resolves the concrete object type for an abstract GraphQL type.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export type GraphQLTypeResolver<TSource, TContext> = (
  value: TSource,
  context: TContext,
  info: GraphQLResolveInfo,
  abstractType: GraphQLAbstractType,
) => PromiseOrValue<string | undefined>;

/**
 * Checks whether a runtime value belongs to a GraphQL object type.
 * @typeParam TSource - Source object type tested against this object type.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export type GraphQLIsTypeOfFn<TSource, TContext> = (
  source: TSource,
  context: TContext,
  info: GraphQLResolveInfo,
) => PromiseOrValue<boolean>;

/**
 * Resolves the runtime value for a GraphQL field.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 * @typeParam TArgs - Argument object type passed to resolvers.
 * @typeParam TResult - Result value type.
 */
export type GraphQLFieldResolver<
  TSource,
  TContext,
  TArgs = any,
  TResult = unknown,
> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult;

/** Information about the currently executing GraphQL field. */
export interface GraphQLResolveInfo {
  /** The field name referenced by this schema coordinate. */
  readonly fieldName: string;
  /** AST field nodes that contributed to the current field execution. */
  readonly fieldNodes: ReadonlyArray<FieldNode>;
  /** GraphQL output type declared for the current field. */
  readonly returnType: GraphQLOutputType;
  /** Object type that owns the current field. */
  readonly parentType: GraphQLObjectType;
  /** Response path where this error occurred during execution. */
  readonly path: Path;
  /** The schema used for validation or execution. */
  readonly schema: GraphQLSchema;
  /** Fragment definitions in the operation document keyed by fragment name. */
  readonly fragments: ObjMap<FragmentDefinitionNode>;
  /** Initial root value passed to the operation. */
  readonly rootValue: unknown;
  /** The operation selected for execution. */
  readonly operation: OperationDefinitionNode;
  /** Runtime variable values keyed by variable name. */
  readonly variableValues: { [variable: string]: unknown };
}

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 * We've provided these template arguments because this is an open type and
 * you may find them useful.
 * @typeParam _TSource - Reserved source type parameter for extension typing.
 * @typeParam _TContext - Reserved context type parameter for extension typing.
 * @typeParam _TArgs - Reserved argument type parameter for extension typing.
 */
export interface GraphQLFieldExtensions<_TSource, _TContext, _TArgs = any> {
  [attributeName: string]: unknown;
}

/**
 * Configuration used to define a GraphQL field.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 * @typeParam TArgs - Argument object type passed to resolvers.
 */
export interface GraphQLFieldConfig<TSource, TContext, TArgs = any> {
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLOutputType;
  /** Arguments accepted by this field or directive. */
  args?: GraphQLFieldConfigArgumentMap;
  /** Resolver function used to produce this field value. */
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  /** Resolver function used to create a subscription event stream for this field. */
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason?: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<
    Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>
  >;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<FieldDefinitionNode>;
}

/** A map of argument names to argument configuration objects. */
export type GraphQLFieldConfigArgumentMap = ObjMap<GraphQLArgumentConfig>;

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLArgumentExtensions {
  [attributeName: string]: unknown;
}

/** Configuration used to define a GraphQL argument. */
export interface GraphQLArgumentConfig {
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLInputType;
  /** Default value used when no explicit value is supplied. */
  defaultValue?: unknown;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason?: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<Readonly<GraphQLArgumentExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<InputValueDefinitionNode>;
}

/**
 * A map of field names to field configuration objects.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export type GraphQLFieldConfigMap<TSource, TContext> = ObjMap<
  GraphQLFieldConfig<TSource, TContext>
>;

/**
 * A resolved GraphQL field definition.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 * @typeParam TArgs - Argument object type passed to resolvers.
 */
export interface GraphQLField<TSource, TContext, TArgs = any> {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLOutputType;
  /** Arguments accepted by this field or directive. */
  args: ReadonlyArray<GraphQLArgument>;
  /** Resolver function used to produce this field value. */
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  /** Resolver function used to create a subscription event stream for this field. */
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<FieldDefinitionNode>;
}

/** A resolved GraphQL argument definition. */
export interface GraphQLArgument {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLInputType;
  /** Default value used when no explicit value is supplied. */
  defaultValue: unknown;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLArgumentExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<InputValueDefinitionNode>;
}

/**
 * Returns true when the argument is non-null and has no default value.
 * @param arg - The argument definition to inspect.
 * @returns True when the argument is non-null and has no default value.
 * @example
 * ```ts
 * import {
 *   GraphQLInt,
 *   GraphQLNonNull,
 *   GraphQLString,
 *   isRequiredArgument,
 * } from 'graphql/type';
 *
 * const requiredArgument = { name: 'id', type: new GraphQLNonNull(GraphQLInt) };
 * const optionalArgument = { name: 'name', type: GraphQLString };
 * const argumentWithDefault = {
 *   name: 'limit',
 *   type: new GraphQLNonNull(GraphQLInt),
 *   defaultValue: 10,
 * };
 *
 * isRequiredArgument(requiredArgument); // => true
 * isRequiredArgument(optionalArgument); // => false
 * isRequiredArgument(argumentWithDefault); // => false
 * ```
 */
export function isRequiredArgument(arg: GraphQLArgument): boolean {
  return isNonNullType(arg.type) && arg.defaultValue === undefined;
}

/**
 * A map of field names to resolved field definitions.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export type GraphQLFieldMap<TSource, TContext> = ObjMap<
  GraphQLField<TSource, TContext>
>;

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLInterfaceTypeExtensions {
  [attributeName: string]: unknown;
}

/**
 * Interface Type Definition
 *
 * When a field can return one of a heterogeneous set of types, a Interface type
 * is used to describe what types are possible, what fields are in common across
 * all types, as well as a function to determine which type is actually used
 * when the field is resolved.
 * @example
 * ```ts
 * const EntityType = new GraphQLInterfaceType({
 *   name: 'Entity',
 *   fields: {
 *     name: { type: GraphQLString }
 *   }
 * });
 * ```
 */
export class GraphQLInterfaceType {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Function that resolves the concrete object type for this abstract type. */
  resolveType: Maybe<GraphQLTypeResolver<any, any>>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLInterfaceTypeExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<InterfaceTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;

  private _fields: ThunkObjMap<GraphQLField<any, any>>;
  private _interfaces: ThunkReadonlyArray<GraphQLInterfaceType>;

  /**
   * Creates a GraphQLInterfaceType instance.
   * @param config - Configuration describing this object.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   * import { GraphQLID, GraphQLInterfaceType, GraphQLNonNull } from 'graphql/type';
   *
   * const document = parse(`
   *   interface Node {
   *     id: ID!
   *   }
   *
   *   interface Resource implements Node {
   *     id: ID!
   *   }
   *
   *   extend interface Resource {
   *     url: String
   *   }
   * `);
   *
   * const Node = new GraphQLInterfaceType({
   *   name: 'Node',
   *   fields: {
   *     id: { type: new GraphQLNonNull(GraphQLID) },
   *   },
   * });
   *
   * const Resource = new GraphQLInterfaceType({
   *   name: 'Resource',
   *   description: 'An addressable resource.',
   *   interfaces: [Node],
   *   fields: {
   *     id: { type: new GraphQLNonNull(GraphQLID) },
   *   },
   *   resolveType: (value) => {
   *     return typeof value === 'object' && value != null && 'url' in value
   *       ? 'WebPage'
   *       : null;
   *   },
   *   extensions: { abstract: true },
   *   astNode: document.definitions[1],
   *   extensionASTNodes: [ document.definitions[2] ],
   * });
   *
   * Resource.name; // => 'Resource'
   * Resource.getInterfaces(); // => [Node]
   * Object.keys(Resource.getFields()); // => ['id']
   * Resource.extensions; // => { abstract: true }
   * ```
   */
  constructor(config: Readonly<GraphQLInterfaceTypeConfig<any, any>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._fields = defineFieldMap.bind(undefined, config);
    this._interfaces = defineInterfaces.bind(undefined, config);
    devAssert(
      config.resolveType == null || typeof config.resolveType === 'function',
      `${this.name} must provide "resolveType" as a function, ` +
        `but got: ${inspect(config.resolveType)}.`,
    );
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag]() {
    return 'GraphQLInterfaceType';
  }

  /**
   * Returns the fields defined by this type.
   * @returns The fields keyed by field name.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertInterfaceType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   interface Node {
   *     id: ID!
   *   }
   *
   *   type User implements Node {
   *     id: ID!
   *   }
   *
   *   type Query {
   *     node: Node
   *   }
   * `);
   *
   * const Node = assertInterfaceType(schema.getType('Node'));
   * const fields = Node.getFields();
   *
   * Object.keys(fields); // => ['id']
   * String(fields.id.type); // => 'ID!'
   * ```
   */
  getFields(): GraphQLFieldMap<any, any> {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  /**
   * Returns the interfaces implemented by this type.
   * @returns The implemented interfaces.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertInterfaceType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   interface Resource {
   *     url: String!
   *   }
   *
   *   interface Image implements Resource {
   *     url: String!
   *     width: Int
   *   }
   *
   *   type Photo implements Resource & Image {
   *     url: String!
   *     width: Int
   *   }
   *
   *   type Query {
   *     image: Image
   *   }
   * `);
   *
   * const Image = assertInterfaceType(schema.getType('Image'));
   *
   * Image.getInterfaces().map((type) => type.name); // => ['Resource']
   * ```
   */
  getInterfaces(): ReadonlyArray<GraphQLInterfaceType> {
    if (typeof this._interfaces === 'function') {
      this._interfaces = this._interfaces();
    }
    return this._interfaces;
  }

  /**
   * Returns a normalized configuration object for this object.
   * @returns A configuration object that can be used to recreate this object.
   * @example
   * ```ts
   * import { GraphQLID, GraphQLInterfaceType, GraphQLNonNull } from 'graphql/type';
   *
   * const Node = new GraphQLInterfaceType({
   *   name: 'Node',
   *   fields: {
   *     id: { type: new GraphQLNonNull(GraphQLID) },
   *   },
   * });
   *
   * const config = Node.toConfig();
   * const NodeCopy = new GraphQLInterfaceType(config);
   *
   * String(config.fields.id.type); // => 'ID!'
   * String(NodeCopy.getFields().id.type); // => 'ID!'
   * ```
   */
  toConfig(): GraphQLInterfaceTypeNormalizedConfig {
    return {
      name: this.name,
      description: this.description,
      interfaces: this.getInterfaces(),
      fields: fieldsToFieldsConfig(this.getFields()),
      resolveType: this.resolveType,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  /**
   * Returns the schema coordinate identifying this interface type.
   * @returns The schema coordinate for this interface type.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertInterfaceType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   interface Node {
   *     id: ID!
   *   }
   *
   *   type User implements Node {
   *     id: ID!
   *   }
   *
   *   type Query {
   *     node: Node
   *   }
   * `);
   *
   * const Node = assertInterfaceType(schema.getType('Node'));
   *
   * Node.toString(); // => 'Node'
   * ```
   */
  toString(): string {
    return this.name;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { GraphQLInterfaceType, GraphQLString } from 'graphql/type';
   *
   * const Named = new GraphQLInterfaceType({
   *   name: 'Named',
   *   fields: { name: { type: GraphQLString } },
   * });
   *
   * Named.toJSON(); // => 'Named'
   * JSON.stringify({ type: Named }); // => '{"type":"Named"}'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

/**
 * Configuration used to construct a GraphQLInterfaceType.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export interface GraphQLInterfaceTypeConfig<TSource, TContext> {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Interfaces implemented by this object or interface type. */
  interfaces?: ThunkReadonlyArray<GraphQLInterfaceType>;
  /** Fields declared by this object, interface, input object, or literal. */
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: Maybe<GraphQLTypeResolver<TSource, TContext>>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<Readonly<GraphQLInterfaceTypeExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<InterfaceTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<InterfaceTypeExtensionNode>>;
}

/** @internal */
export interface GraphQLInterfaceTypeNormalizedConfig
  extends GraphQLInterfaceTypeConfig<any, any> {
  interfaces: ReadonlyArray<GraphQLInterfaceType>;
  fields: GraphQLFieldConfigMap<any, any>;
  extensions: Readonly<GraphQLInterfaceTypeExtensions>;
  extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;
}

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLUnionTypeExtensions {
  [attributeName: string]: unknown;
}

/**
 * Union Type Definition
 *
 * When a field can return one of a heterogeneous set of types, a Union type
 * is used to describe what types are possible as well as providing a function
 * to determine which type is actually used when the field is resolved.
 * @example
 * ```ts
 * const PetType = new GraphQLUnionType({
 *   name: 'Pet',
 *   types: [DogType, CatType],
 *   resolveType: (value) => {
 *     if (value instanceof Dog) {
 *       return DogType;
 *     }
 *     if (value instanceof Cat) {
 *       return CatType;
 *     }
 *   }
 * });
 * ```
 */
export class GraphQLUnionType {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Function that resolves the concrete object type for this abstract type. */
  resolveType: Maybe<GraphQLTypeResolver<any, any>>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLUnionTypeExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<UnionTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes: ReadonlyArray<UnionTypeExtensionNode>;

  private _types: ThunkReadonlyArray<GraphQLObjectType>;

  /**
   * Creates a GraphQLUnionType instance.
   * @param config - Configuration describing this object.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   * import { GraphQLObjectType, GraphQLString, GraphQLUnionType } from 'graphql/type';
   *
   * const document = parse(`
   *   union Media = Photo | Video
   *
   *   extend union Media = Audio
   * `);
   *
   * const Photo = new GraphQLObjectType({
   *   name: 'Photo',
   *   fields: { url: { type: GraphQLString } },
   * });
   * const Video = new GraphQLObjectType({
   *   name: 'Video',
   *   fields: { url: { type: GraphQLString } },
   * });
   *
   * const Media = new GraphQLUnionType({
   *   name: 'Media',
   *   description: 'Media that can appear in a search result.',
   *   types: [Photo, Video],
   *   resolveType: (value) => {
   *     return typeof value === 'object' && value != null && 'duration' in value
   *       ? 'Video'
   *       : 'Photo';
   *   },
   *   extensions: { searchable: true },
   *   astNode: document.definitions[0],
   *   extensionASTNodes: [ document.definitions[1] ],
   * });
   *
   * Media.description; // => 'Media that can appear in a search result.'
   * Media.getTypes().map((type) => type.name); // => ['Photo', 'Video']
   * Media.extensions; // => { searchable: true }
   * ```
   */
  constructor(config: Readonly<GraphQLUnionTypeConfig<any, any>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._types = defineTypes.bind(undefined, config);
    devAssert(
      config.resolveType == null || typeof config.resolveType === 'function',
      `${this.name} must provide "resolveType" as a function, ` +
        `but got: ${inspect(config.resolveType)}.`,
    );
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag]() {
    return 'GraphQLUnionType';
  }

  /**
   * Returns the object types included in this union.
   * @returns The union member object types.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertUnionType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   type Photo {
   *     url: String!
   *   }
   *
   *   type Video {
   *     url: String!
   *   }
   *
   *   union Media = Photo | Video
   *
   *   type Query {
   *     media: [Media]
   *   }
   * `);
   *
   * const Media = assertUnionType(schema.getType('Media'));
   *
   * Media.getTypes().map((type) => type.name); // => ['Photo', 'Video']
   * ```
   */
  getTypes(): ReadonlyArray<GraphQLObjectType> {
    if (typeof this._types === 'function') {
      this._types = this._types();
    }
    return this._types;
  }

  /**
   * Returns a normalized configuration object for this object.
   * @returns A configuration object that can be used to recreate this object.
   * @example
   * ```ts
   * import { GraphQLObjectType, GraphQLString, GraphQLUnionType } from 'graphql/type';
   *
   * const Photo = new GraphQLObjectType({
   *   name: 'Photo',
   *   fields: { url: { type: GraphQLString } },
   * });
   * const Video = new GraphQLObjectType({
   *   name: 'Video',
   *   fields: { url: { type: GraphQLString } },
   * });
   * const Media = new GraphQLUnionType({
   *   name: 'Media',
   *   types: [Photo, Video],
   * });
   *
   * const config = Media.toConfig();
   * const MediaCopy = new GraphQLUnionType(config);
   *
   * MediaCopy.getTypes().map((type) => type.name); // => ['Photo', 'Video']
   * ```
   */
  toConfig(): GraphQLUnionTypeNormalizedConfig {
    return {
      name: this.name,
      description: this.description,
      types: this.getTypes(),
      resolveType: this.resolveType,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  /**
   * Returns the schema coordinate identifying this union type.
   * @returns The schema coordinate for this union type.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertUnionType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   type Photo {
   *     url: String!
   *   }
   *
   *   union SearchResult = Photo
   *
   *   type Query {
   *     search: [SearchResult]
   *   }
   * `);
   *
   * const SearchResult = assertUnionType(schema.getType('SearchResult'));
   *
   * SearchResult.toString(); // => 'SearchResult'
   * ```
   */
  toString(): string {
    return this.name;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { GraphQLObjectType, GraphQLString, GraphQLUnionType } from 'graphql/type';
   *
   * const Photo = new GraphQLObjectType({
   *   name: 'Photo',
   *   fields: { url: { type: GraphQLString } },
   * });
   * const SearchResult = new GraphQLUnionType({
   *   name: 'SearchResult',
   *   types: [Photo],
   * });
   *
   * SearchResult.toJSON(); // => 'SearchResult'
   * JSON.stringify({ type: SearchResult }); // => '{"type":"SearchResult"}'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

function defineTypes(
  config: Readonly<GraphQLUnionTypeConfig<unknown, unknown>>,
): ReadonlyArray<GraphQLObjectType> {
  const types = resolveReadonlyArrayThunk(config.types);
  devAssert(
    Array.isArray(types),
    `Must provide Array of types or a function which returns such an array for Union ${config.name}.`,
  );
  return types;
}

/**
 * Configuration used to construct a GraphQLUnionType.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export interface GraphQLUnionTypeConfig<TSource, TContext> {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Object types that belong to this union type. */
  types: ThunkReadonlyArray<GraphQLObjectType>;
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: Maybe<GraphQLTypeResolver<TSource, TContext>>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<Readonly<GraphQLUnionTypeExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<UnionTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<UnionTypeExtensionNode>>;
}

interface GraphQLUnionTypeNormalizedConfig
  extends GraphQLUnionTypeConfig<any, any> {
  types: ReadonlyArray<GraphQLObjectType>;
  extensions: Readonly<GraphQLUnionTypeExtensions>;
  extensionASTNodes: ReadonlyArray<UnionTypeExtensionNode>;
}

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLEnumTypeExtensions {
  [attributeName: string]: unknown;
}

/**
 * Enum Type Definition
 *
 * Enum types define leaf values whose serialized form is one of a fixed set
 * of GraphQL enum names. Internally, enum values can map to any runtime value,
 * often integers.
 * @example
 * ```ts
 * import { GraphQLEnumType } from 'graphql/type';
 *
 * const RGBType = new GraphQLEnumType({
 *   name: 'RGB',
 *   values: {
 *     RED: { value: 0 },
 *     GREEN: { value: 1 },
 *     BLUE: { value: 2 },
 *   },
 * });
 *
 * RGBType.getValue('GREEN')?.value; // => 1
 * ```
 *
 * Note: If a value is not provided in a definition, the name of the enum value
 * will be used as its internal value.
 */
export class GraphQLEnumType /* <T> */ {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLEnumTypeExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<EnumTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;

  private _values:
    | ReadonlyArray<GraphQLEnumValue /* <T> */>
    | (() => GraphQLEnumValueConfigMap);

  private _valueLookup: ReadonlyMap<any /* T */, GraphQLEnumValue> | null;
  private _nameLookup: ObjMap<GraphQLEnumValue> | null;

  /**
   * Creates a GraphQLEnumType instance.
   * @param config - Configuration describing this object.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   * import { GraphQLEnumType } from 'graphql/type';
   *
   * const document = parse(`
   *   enum Episode {
   *     NEW_HOPE
   *     EMPIRE
   *     JEDI
   *   }
   *
   *   extend enum Episode {
   *     FORCE_AWAKENS
   *   }
   * `);
   * const definition = document.definitions[0];
   *
   * const Episode = new GraphQLEnumType({
   *   name: 'Episode',
   *   description: 'A Star Wars film episode.',
   *   values: {
   *     NEW_HOPE: {
   *       value: 4,
   *       description: 'Released in 1977.',
   *       extensions: { trilogy: 'original' },
   *       astNode: definition.values[0],
   *     },
   *     EMPIRE: { value: 5, astNode: definition.values[1] },
   *     JEDI: {
   *       value: 6,
   *       deprecationReason: 'Use RETURN_OF_THE_JEDI.',
   *       astNode: definition.values[2],
   *     },
   *   },
   *   extensions: { catalog: 'films' },
   *   astNode: definition,
   *   extensionASTNodes: [ document.definitions[1] ],
   * });
   *
   * Episode.description; // => 'A Star Wars film episode.'
   * Episode.serialize(5); // => 'EMPIRE'
   * Episode.parseValue('JEDI'); // => 6
   * Episode.getValue('JEDI').deprecationReason; // => 'Use RETURN_OF_THE_JEDI.'
   * Episode.extensions; // => { catalog: 'films' }
   * ```
   */
  constructor(config: Readonly<GraphQLEnumTypeConfig /* <T> */>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._values =
      typeof config.values === 'function'
        ? config.values
        : defineEnumValues(this.name, config.values);
    this._valueLookup = null;
    this._nameLookup = null;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag]() {
    return 'GraphQLEnumType';
  }

  /**
   * Returns the values defined by this enum type.
   * @returns Enum value definitions in schema order.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertEnumType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   enum Episode {
   *     NEW_HOPE
   *     EMPIRE
   *     JEDI
   *   }
   *
   *   type Query {
   *     episode: Episode
   *   }
   * `);
   *
   * const Episode = assertEnumType(schema.getType('Episode'));
   *
   * Episode.getValues().map((value) => value.name); // => ['NEW_HOPE', 'EMPIRE', 'JEDI']
   * ```
   */
  getValues(): ReadonlyArray<GraphQLEnumValue /* <T> */> {
    if (typeof this._values === 'function') {
      this._values = defineEnumValues(this.name, this._values());
    }
    return this._values;
  }

  /**
   * Returns the enum value definition for a value name.
   * @param name - The GraphQL name to look up.
   * @returns The matching enum value definition, if it exists.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertEnumType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   enum Episode {
   *     NEW_HOPE
   *     EMPIRE
   *   }
   *
   *   type Query {
   *     episode: Episode
   *   }
   * `);
   *
   * const Episode = assertEnumType(schema.getType('Episode'));
   *
   * Episode.getValue('EMPIRE')?.name; // => 'EMPIRE'
   * Episode.getValue('JEDI'); // => undefined
   * ```
   */
  getValue(name: string): Maybe<GraphQLEnumValue> {
    if (this._nameLookup === null) {
      this._nameLookup = keyMap(this.getValues(), (value) => value.name);
    }
    return this._nameLookup[name];
  }

  /**
   * Serializes a runtime enum value as a GraphQL enum name.
   * @param outputValue - Runtime enum value to serialize.
   * @returns The GraphQL enum name for the runtime value.
   * @example
   * ```ts
   * import { GraphQLEnumType } from 'graphql/type';
   *
   * const RGB = new GraphQLEnumType({
   *   name: 'RGB',
   *   values: {
   *     RED: { value: 0 },
   *     GREEN: { value: 1 },
   *     BLUE: { value: 2 },
   *   },
   * });
   *
   * RGB.serialize(1); // => 'GREEN'
   * RGB.serialize(3); // throws an error
   * ```
   */
  serialize(outputValue: unknown /* T */): Maybe<string> {
    if (this._valueLookup === null) {
      this._valueLookup = new Map(
        this.getValues().map((enumValue) => [enumValue.value, enumValue]),
      );
    }
    const enumValue = this._valueLookup.get(outputValue);
    if (enumValue === undefined) {
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent value: ${inspect(outputValue)}`,
      );
    }
    return enumValue.name;
  }

  /**
   * Parses a GraphQL enum name from variable input.
   * @param inputValue - Runtime input value to parse.
   * @returns The internal enum value represented by the input name.
   * @example
   * ```ts
   * import { GraphQLEnumType } from 'graphql/type';
   *
   * const RGB = new GraphQLEnumType({
   *   name: 'RGB',
   *   values: {
   *     RED: { value: 0 },
   *     GREEN: { value: 1 },
   *     BLUE: { value: 2 },
   *   },
   * });
   *
   * RGB.parseValue('BLUE'); // => 2
   * RGB.parseValue('PURPLE'); // throws an error
   * RGB.parseValue(2); // throws an error
   * ```
   */
  parseValue(inputValue: unknown): Maybe<any> /* T */ {
    if (typeof inputValue !== 'string') {
      const valueStr = inspect(inputValue);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-string value: ${valueStr}.` +
          didYouMeanEnumValue(this, valueStr),
      );
    }

    const enumValue = this.getValue(inputValue);
    if (enumValue == null) {
      throw new GraphQLError(
        `Value "${inputValue}" does not exist in "${this.name}" enum.` +
          didYouMeanEnumValue(this, inputValue),
      );
    }
    return enumValue.value;
  }

  /**
   * Parses a GraphQL enum name from an AST value literal.
   * @param valueNode - AST value literal to parse.
   * @param _variables - Runtime variable values; ignored because enum literals cannot contain variables.
   * @returns The internal enum value represented by the literal.
   * @example
   * ```ts
   * import { parseValue } from 'graphql/language';
   * import { GraphQLEnumType } from 'graphql/type';
   *
   * const RGB = new GraphQLEnumType({
   *   name: 'RGB',
   *   values: {
   *     RED: { value: 0 },
   *     GREEN: { value: 1 },
   *     BLUE: { value: 2 },
   *   },
   * });
   *
   * RGB.parseLiteral(parseValue('RED')); // => 0
   * RGB.parseLiteral(parseValue('"RED"')); // throws an error
   * ```
   */
  parseLiteral(
    valueNode: ValueNode,
    _variables: Maybe<ObjMap<unknown>>,
  ): Maybe<any> /* T */ {
    // Note: variables will be resolved to a value before calling this function.
    if (valueNode.kind !== Kind.ENUM) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` +
          didYouMeanEnumValue(this, valueStr),
        { nodes: valueNode },
      );
    }

    const enumValue = this.getValue(valueNode.value);
    if (enumValue == null) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Value "${valueStr}" does not exist in "${this.name}" enum.` +
          didYouMeanEnumValue(this, valueStr),
        { nodes: valueNode },
      );
    }
    return enumValue.value;
  }

  /**
   * Returns a normalized configuration object for this object.
   * @returns A configuration object that can be used to recreate this object.
   * @example
   * ```ts
   * import { GraphQLEnumType } from 'graphql/type';
   *
   * const RGB = new GraphQLEnumType({
   *   name: 'RGB',
   *   values: {
   *     RED: { value: 0 },
   *     GREEN: { value: 1 },
   *     BLUE: { value: 2 },
   *   },
   * });
   *
   * const config = RGB.toConfig();
   * const RGBCopy = new GraphQLEnumType(config);
   *
   * config.values.GREEN.value; // => 1
   * RGBCopy.serialize(2); // => 'BLUE'
   * ```
   */
  toConfig(): GraphQLEnumTypeNormalizedConfig {
    const values = keyValMap(
      this.getValues(),
      (value) => value.name,
      (value) => ({
        description: value.description,
        value: value.value,
        deprecationReason: value.deprecationReason,
        extensions: value.extensions,
        astNode: value.astNode,
      }),
    );

    return {
      name: this.name,
      description: this.description,
      values,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
    };
  }

  /**
   * Returns the schema coordinate identifying this enum type.
   * @returns The schema coordinate for this enum type.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertEnumType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   enum Episode {
   *     NEW_HOPE
   *   }
   *
   *   type Query {
   *     episode: Episode
   *   }
   * `);
   *
   * const Episode = assertEnumType(schema.getType('Episode'));
   *
   * Episode.toString(); // => 'Episode'
   * ```
   */
  toString(): string {
    return this.name;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { GraphQLEnumType } from 'graphql/type';
   *
   * const Episode = new GraphQLEnumType({
   *   name: 'Episode',
   *   values: {
   *     NEW_HOPE: {},
   *   },
   * });
   *
   * Episode.toJSON(); // => 'Episode'
   * JSON.stringify({ type: Episode }); // => '{"type":"Episode"}'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

function didYouMeanEnumValue(
  enumType: GraphQLEnumType,
  unknownValueStr: string,
): string {
  const allNames = enumType.getValues().map((value) => value.name);
  const suggestedValues = suggestionList(unknownValueStr, allNames);

  return didYouMean('the enum value', suggestedValues);
}

function defineEnumValues(
  typeName: string,
  valueMap: GraphQLEnumValueConfigMap /* <T> */,
): ReadonlyArray<GraphQLEnumValue /* <T> */> {
  devAssert(
    isPlainObj(valueMap),
    `${typeName} values must be an object with value names as keys.`,
  );
  return Object.entries(valueMap).map(([valueName, valueConfig]) => {
    devAssert(
      isPlainObj(valueConfig),
      `${typeName}.${valueName} must refer to an object with a "value" key ` +
        `representing an internal value but got: ${inspect(valueConfig)}.`,
    );
    return {
      name: assertEnumValueName(valueName),
      description: valueConfig.description,
      value: valueConfig.value !== undefined ? valueConfig.value : valueName,
      deprecationReason: valueConfig.deprecationReason,
      extensions: toObjMap(valueConfig.extensions),
      astNode: valueConfig.astNode,
    };
  });
}

/** Configuration used to construct a GraphQLEnumType. */
export interface GraphQLEnumTypeConfig {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Values contained in this enum, list, or input-object definition. */
  values: ThunkObjMap<GraphQLEnumValueConfig /* <T> */>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<Readonly<GraphQLEnumTypeExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<EnumTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<EnumTypeExtensionNode>>;
}

interface GraphQLEnumTypeNormalizedConfig extends GraphQLEnumTypeConfig {
  values: ObjMap<GraphQLEnumValueConfig /* <T> */>;
  extensions: Readonly<GraphQLEnumTypeExtensions>;
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;
}

/** A map of enum value names to enum value configuration objects. */
export type GraphQLEnumValueConfigMap /* <T> */ =
  ObjMap<GraphQLEnumValueConfig /* <T> */>;

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLEnumValueExtensions {
  [attributeName: string]: unknown;
}

/** Configuration used to define a GraphQL enum value. */
export interface GraphQLEnumValueConfig {
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Parsed value represented by this node. */
  value?: any /* T */;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason?: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<Readonly<GraphQLEnumValueExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<EnumValueDefinitionNode>;
}

/** A resolved GraphQL enum value definition. */
export interface GraphQLEnumValue {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Parsed value represented by this node. */
  value: any /* T */;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLEnumValueExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<EnumValueDefinitionNode>;
}

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLInputObjectTypeExtensions {
  [attributeName: string]: unknown;
}

/**
 * Input Object Type Definition
 *
 * An input object defines a structured collection of fields which may be
 * supplied to a field argument.
 *
 * Using `NonNull` will ensure that a value must be provided by the query
 * @example
 * ```ts
 * const GeoPoint = new GraphQLInputObjectType({
 *   name: 'GeoPoint',
 *   fields: {
 *     lat: { type: new GraphQLNonNull(GraphQLFloat) },
 *     lon: { type: new GraphQLNonNull(GraphQLFloat) },
 *     alt: { type: GraphQLFloat, defaultValue: 0 },
 *   }
 * });
 * ```
 */
export class GraphQLInputObjectType {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLInputObjectTypeExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<InputObjectTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes: ReadonlyArray<InputObjectTypeExtensionNode>;
  /** Whether this input object uses the experimental OneOf input object semantics. */
  isOneOf: boolean;

  private _fields: ThunkObjMap<GraphQLInputField>;

  /**
   * Creates a GraphQLInputObjectType instance.
   * @param config - Configuration describing this object.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   * import {
   *   GraphQLID,
   *   GraphQLInputObjectType,
   *   GraphQLInt,
   *   GraphQLNonNull,
   *   GraphQLString,
   * } from 'graphql/type';
   *
   * const document = parse(`
   *   input ReviewInput {
   *     stars: Int!
   *     commentary: String
   *   }
   *
   *   extend input ReviewInput {
   *     body: String
   *   }
   * `);
   * const definition = document.definitions[0];
   *
   * const ReviewInput = new GraphQLInputObjectType({
   *   name: 'ReviewInput',
   *   description: 'Input collected when reviewing a product.',
   *   fields: {
   *     stars: {
   *       description: 'Star rating from one to five.',
   *       type: new GraphQLNonNull(GraphQLInt),
   *       extensions: { min: 1, max: 5 },
   *       astNode: definition.fields[0],
   *     },
   *     commentary: {
   *       type: GraphQLString,
   *       defaultValue: '',
   *       deprecationReason: 'Use body.',
   *       astNode: definition.fields[1],
   *     },
   *   },
   *   extensions: { form: 'review' },
   *   astNode: definition,
   *   extensionASTNodes: [ document.definitions[1] ],
   *   isOneOf: false,
   * });
   * const SearchBy = new GraphQLInputObjectType({
   *   name: 'SearchBy',
   *   fields: {
   *     id: { type: GraphQLID },
   *     slug: { type: GraphQLString },
   *   },
   *   isOneOf: true,
   * });
   *
   * const fields = ReviewInput.getFields();
   *
   * ReviewInput.description; // => 'Input collected when reviewing a product.'
   * String(fields.stars.type); // => 'Int!'
   * fields.stars.extensions; // => { min: 1, max: 5 }
   * fields.commentary.defaultValue; // => ''
   * fields.commentary.deprecationReason; // => 'Use body.'
   * ReviewInput.isOneOf; // => false
   * SearchBy.isOneOf; // => true
   * ```
   */
  constructor(config: Readonly<GraphQLInputObjectTypeConfig>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.extensions = toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];
    this.isOneOf = config.isOneOf ?? false;

    this._fields = defineInputFieldMap.bind(undefined, config);
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag]() {
    return 'GraphQLInputObjectType';
  }

  /**
   * Returns the fields defined by this type.
   * @returns The fields keyed by field name.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertInputObjectType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   input ReviewInput {
   *     stars: Int!
   *     commentary: String = ""
   *   }
   *
   *   type Query {
   *     reviews(filter: ReviewInput): [String]
   *   }
   * `);
   *
   * const ReviewInput = assertInputObjectType(schema.getType('ReviewInput'));
   * const fields = ReviewInput.getFields();
   *
   * Object.keys(fields); // => ['stars', 'commentary']
   * fields.commentary.defaultValue; // => ''
   * ```
   */
  getFields(): GraphQLInputFieldMap {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  /**
   * Returns a normalized configuration object for this object.
   * @returns A configuration object that can be used to recreate this object.
   * @example
   * ```ts
   * import {
   *   GraphQLInputObjectType,
   *   GraphQLInt,
   *   GraphQLNonNull,
   * } from 'graphql/type';
   *
   * const ReviewInput = new GraphQLInputObjectType({
   *   name: 'ReviewInput',
   *   fields: {
   *     stars: { type: new GraphQLNonNull(GraphQLInt) },
   *   },
   * });
   *
   * const config = ReviewInput.toConfig();
   * const ReviewInputCopy = new GraphQLInputObjectType(config);
   *
   * String(config.fields.stars.type); // => 'Int!'
   * String(ReviewInputCopy.getFields().stars.type); // => 'Int!'
   * ```
   */
  toConfig(): GraphQLInputObjectTypeNormalizedConfig {
    const fields = mapValue(this.getFields(), (field) => ({
      description: field.description,
      type: field.type,
      defaultValue: field.defaultValue,
      deprecationReason: field.deprecationReason,
      extensions: field.extensions,
      astNode: field.astNode,
    }));

    return {
      name: this.name,
      description: this.description,
      fields,
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
      isOneOf: this.isOneOf,
    };
  }

  /**
   * Returns the schema coordinate identifying this input object type.
   * @returns The schema coordinate for this input object type.
   * @example
   * ```ts
   * import { buildSchema } from 'graphql/utilities';
   * import { assertInputObjectType } from 'graphql/type';
   *
   * const schema = buildSchema(`
   *   input ReviewInput {
   *     stars: Int!
   *   }
   *
   *   type Query {
   *     reviews(filter: ReviewInput): [String]
   *   }
   * `);
   *
   * const ReviewInput = assertInputObjectType(schema.getType('ReviewInput'));
   *
   * ReviewInput.toString(); // => 'ReviewInput'
   * ```
   */
  toString(): string {
    return this.name;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The JSON-serializable representation.
   * @example
   * ```ts
   * import { GraphQLInputObjectType, GraphQLString } from 'graphql/type';
   *
   * const ReviewInput = new GraphQLInputObjectType({
   *   name: 'ReviewInput',
   *   fields: {
   *     commentary: { type: GraphQLString },
   *   },
   * });
   *
   * ReviewInput.toJSON(); // => 'ReviewInput'
   * JSON.stringify({ type: ReviewInput }); // => '{"type":"ReviewInput"}'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

function defineInputFieldMap(
  config: Readonly<GraphQLInputObjectTypeConfig>,
): GraphQLInputFieldMap {
  const fieldMap = resolveObjMapThunk(config.fields);
  devAssert(
    isPlainObj(fieldMap),
    `${config.name} fields must be an object with field names as keys or a function which returns such an object.`,
  );
  return mapValue(fieldMap, (fieldConfig, fieldName) => {
    devAssert(
      !('resolve' in fieldConfig),
      `${config.name}.${fieldName} field has a resolve property, but Input Types cannot define resolvers.`,
    );

    return {
      name: assertName(fieldName),
      description: fieldConfig.description,
      type: fieldConfig.type,
      defaultValue: fieldConfig.defaultValue,
      deprecationReason: fieldConfig.deprecationReason,
      extensions: toObjMap(fieldConfig.extensions),
      astNode: fieldConfig.astNode,
    };
  });
}

/** Configuration used to construct a GraphQLInputObjectType. */
export interface GraphQLInputObjectTypeConfig {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Fields declared by this object, interface, input object, or literal. */
  fields: ThunkObjMap<GraphQLInputFieldConfig>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<Readonly<GraphQLInputObjectTypeExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<InputObjectTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<InputObjectTypeExtensionNode>>;
  /** Whether this input object uses the experimental OneOf input object semantics. */
  isOneOf?: boolean;
}

interface GraphQLInputObjectTypeNormalizedConfig
  extends GraphQLInputObjectTypeConfig {
  fields: GraphQLInputFieldConfigMap;
  extensions: Readonly<GraphQLInputObjectTypeExtensions>;
  extensionASTNodes: ReadonlyArray<InputObjectTypeExtensionNode>;
}

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLInputFieldExtensions {
  [attributeName: string]: unknown;
}

/** Configuration used to define a GraphQL input field. */
export interface GraphQLInputFieldConfig {
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLInputType;
  /** Default value used when no explicit value is supplied. */
  defaultValue?: unknown;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason?: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions?: Maybe<Readonly<GraphQLInputFieldExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<InputValueDefinitionNode>;
}

/** A map of input field names to input field configuration objects. */
export type GraphQLInputFieldConfigMap = ObjMap<GraphQLInputFieldConfig>;

/** A resolved GraphQL input field definition. */
export interface GraphQLInputField {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLInputType;
  /** Default value used when no explicit value is supplied. */
  defaultValue: unknown;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason: Maybe<string>;
  /** Custom extension fields reserved for users. */
  extensions: Readonly<GraphQLInputFieldExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<InputValueDefinitionNode>;
}

/**
 * Returns true when the input field is non-null and has no default value.
 * @param field - The input field definition to inspect.
 * @returns True when the input field is non-null and has no default value.
 * @example
 * ```ts
 * import {
 *   GraphQLInt,
 *   GraphQLNonNull,
 *   GraphQLString,
 *   isRequiredInputField,
 * } from 'graphql/type';
 *
 * const requiredField = { name: 'id', type: new GraphQLNonNull(GraphQLInt) };
 * const optionalField = { name: 'name', type: GraphQLString };
 * const fieldWithDefault = {
 *   name: 'limit',
 *   type: new GraphQLNonNull(GraphQLInt),
 *   defaultValue: 10,
 * };
 *
 * isRequiredInputField(requiredField); // => true
 * isRequiredInputField(optionalField); // => false
 * isRequiredInputField(fieldWithDefault); // => false
 * ```
 */
export function isRequiredInputField(field: GraphQLInputField): boolean {
  return isNonNullType(field.type) && field.defaultValue === undefined;
}

/** A map of input field names to resolved input field definitions. */
export type GraphQLInputFieldMap = ObjMap<GraphQLInputField>;
