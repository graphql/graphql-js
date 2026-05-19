/** @category Definitions */

import { devAssert } from '../jsutils/devAssert.ts';
import { didYouMean } from '../jsutils/didYouMean.ts';
import { identityFunc } from '../jsutils/identityFunc.ts';
import { inspect } from '../jsutils/inspect.ts';
import { instanceOf } from '../jsutils/instanceOf.ts';
import { keyMap } from '../jsutils/keyMap.ts';
import { keyValMap } from '../jsutils/keyValMap.ts';
import { mapValue } from '../jsutils/mapValue.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { Path } from '../jsutils/Path.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';
import { suggestionList } from '../jsutils/suggestionList.ts';
import { toObjMapWithSymbols } from '../jsutils/toObjMap.ts';

import { GraphQLError } from '../error/GraphQLError.ts';

import type {
  ConstValueNode,
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
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import { print } from '../language/printer.ts';

import type { GraphQLVariableSignature } from '../execution/getVariableSignature.ts';
import type { VariableValues } from '../execution/values.ts';

import { valueFromASTUntyped } from '../utilities/valueFromASTUntyped.ts';

import { assertEnumValueName, assertName } from './assertName.ts';
import type { GraphQLDirective } from './directives.ts';
import type { GraphQLSchema } from './schema.ts';

// Predicates & Assertions

/** These are all of the possible kinds of types. */
export type GraphQLType = GraphQLNamedType | GraphQLWrappingType;

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

/** @private */
const scalarSymbol: unique symbol = Symbol('Scalar');

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
  return instanceOf(type, scalarSymbol, GraphQLScalarType);
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

/** @private */
const objectSymbol: unique symbol = Symbol('Object');

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
  return instanceOf(type, objectSymbol, GraphQLObjectType);
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

/** @private */
const fieldSymbol: unique symbol = Symbol('Field');

/**
 * Returns true when the value is a resolved GraphQL field definition.
 * @param field - Value to inspect.
 * @returns True when the value is a GraphQLField.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isField } from 'graphql/type';
 *
 * const schema = buildSchema('type Query { greeting: String }');
 * const field = schema.getQueryType().getFields().greeting;
 *
 * isField(field); // => true
 * isField(schema.getQueryType()); // => false
 * ```
 */
export function isField(field: unknown): field is GraphQLField {
  return instanceOf(field, fieldSymbol, GraphQLField);
}

/**
 * Returns the value as a GraphQLField, or throws if it is not one.
 * @param field - Value to inspect.
 * @returns The value typed as a GraphQLField.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertField } from 'graphql/type';
 *
 * const schema = buildSchema('type Query { greeting: String }');
 * const field = assertField(schema.getQueryType().getFields().greeting);
 *
 * field.name; // => 'greeting'
 * assertField(schema.getQueryType()); // throws an error
 * ```
 */
export function assertField(field: unknown): GraphQLField {
  if (!isField(field)) {
    throw new Error(`Expected ${inspect(field)} to be a GraphQL field.`);
  }
  return field;
}

/** @private */
const argumentSymbol: unique symbol = Symbol('Argument');

/**
 * Returns true when the value is a resolved GraphQL argument definition.
 * @param arg - Value to inspect.
 * @returns True when the value is a GraphQLArgument.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { isArgument } from 'graphql/type';
 *
 * const schema = buildSchema('type Query { greeting(name: String): String }');
 * const arg = schema.getQueryType().getFields().greeting.args[0];
 *
 * isArgument(arg); // => true
 * isArgument(schema.getQueryType()); // => false
 * ```
 */
export function isArgument(arg: unknown): arg is GraphQLArgument {
  return instanceOf(arg, argumentSymbol, GraphQLArgument);
}

/**
 * Returns the value as a GraphQLArgument, or throws if it is not one.
 * @param arg - Value to inspect.
 * @returns The value typed as a GraphQLArgument.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertArgument } from 'graphql/type';
 *
 * const schema = buildSchema('type Query { greeting(name: String): String }');
 * const arg = assertArgument(schema.getQueryType().getFields().greeting.args[0]);
 *
 * arg.name; // => 'name'
 * assertArgument(schema.getQueryType()); // throws an error
 * ```
 */
export function assertArgument(arg: unknown): GraphQLArgument {
  if (!isArgument(arg)) {
    throw new Error(`Expected ${inspect(arg)} to be a GraphQL argument.`);
  }
  return arg;
}

/** @private */
const interfaceSymbol: unique symbol = Symbol('Interface');

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
  return instanceOf(type, interfaceSymbol, GraphQLInterfaceType);
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

/** @private */
const unionSymbol: unique symbol = Symbol('Union');

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
  return instanceOf(type, unionSymbol, GraphQLUnionType);
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

/** @private */
const enumSymbol: unique symbol = Symbol('Enum');

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
  return instanceOf(type, enumSymbol, GraphQLEnumType);
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

/** @private */
const enumValueSymbol: unique symbol = Symbol('EnumValue');

/**
 * Returns true when the value is a resolved GraphQL enum value definition.
 * @param value - Value to inspect.
 * @returns True when the value is a GraphQLEnumValue.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertEnumType, isEnumValue } from 'graphql/type';
 *
 * const schema = buildSchema('enum Episode { NEW_HOPE } type Query { episode: Episode }');
 * const enumValue = assertEnumType(schema.getType('Episode')).getValues()[0];
 *
 * isEnumValue(enumValue); // => true
 * isEnumValue(schema.getType('Episode')); // => false
 * ```
 */
export function isEnumValue(value: unknown): value is GraphQLEnumValue {
  return instanceOf(value, enumValueSymbol, GraphQLEnumValue);
}

/**
 * Returns the value as a GraphQLEnumValue, or throws if it is not one.
 * @param value - Value to inspect.
 * @returns The value typed as a GraphQLEnumValue.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertEnumType, assertEnumValue } from 'graphql/type';
 *
 * const schema = buildSchema('enum Episode { NEW_HOPE } type Query { episode: Episode }');
 * const enumValue = assertEnumValue(
 *   assertEnumType(schema.getType('Episode')).getValues()[0],
 * );
 *
 * enumValue.name; // => 'NEW_HOPE'
 * assertEnumValue(schema.getType('Episode')); // throws an error
 * ```
 */
export function assertEnumValue(value: unknown): GraphQLEnumValue {
  if (!isEnumValue(value)) {
    throw new Error(`Expected ${inspect(value)} to be a GraphQL Enum value.`);
  }
  return value;
}

/** @private */
const inputObjectSymbol: unique symbol = Symbol('InputObject');

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
  return instanceOf(type, inputObjectSymbol, GraphQLInputObjectType);
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

/** @private */
const inputFieldSymbol: unique symbol = Symbol('InputField');

/**
 * Returns true when the value is a resolved GraphQL input field definition.
 * @param field - Value to inspect.
 * @returns True when the value is a GraphQLInputField.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertInputObjectType, isInputField } from 'graphql/type';
 *
 * const schema = buildSchema('input ReviewInput { stars: Int } type Query { ok: Boolean }');
 * const inputField = assertInputObjectType(schema.getType('ReviewInput')).getFields().stars;
 *
 * isInputField(inputField); // => true
 * isInputField(schema.getQueryType()); // => false
 * ```
 */
export function isInputField(field: unknown): field is GraphQLInputField {
  return instanceOf(field, inputFieldSymbol, GraphQLInputField);
}

/**
 * Returns the value as a GraphQLInputField, or throws if it is not one.
 * @param field - Value to inspect.
 * @returns The value typed as a GraphQLInputField.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertInputField, assertInputObjectType } from 'graphql/type';
 *
 * const schema = buildSchema('input ReviewInput { stars: Int } type Query { ok: Boolean }');
 * const inputField = assertInputField(
 *   assertInputObjectType(schema.getType('ReviewInput')).getFields().stars,
 * );
 *
 * inputField.name; // => 'stars'
 * assertInputField(schema.getQueryType()); // throws an error
 * ```
 */
export function assertInputField(field: unknown): GraphQLInputField {
  if (!isInputField(field)) {
    throw new Error(`Expected ${inspect(field)} to be a GraphQL input field.`);
  }
  return field;
}

/** @private */
const listSymbol: unique symbol = Symbol('List');

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
/**
 * Returns true when the value is a GraphQLList.
 * @internal
 */
export function isListType(type: unknown): type is GraphQLList<GraphQLType> {
  return instanceOf(type, listSymbol, GraphQLList);
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

/** @private */
const nonNullSymbol: unique symbol = Symbol('NonNull');

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
): type is GraphQLNonNull<GraphQLNullableInputType>;
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
): type is GraphQLNonNull<GraphQLNullableOutputType>;
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
): type is GraphQLNonNull<GraphQLNullableType>;
/**
 * Returns true when the value is a GraphQLNonNull.
 * @internal
 */
export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLNullableType> {
  return instanceOf(type, nonNullSymbol, GraphQLNonNull);
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
export function assertNonNullType(
  type: unknown,
): GraphQLNonNull<GraphQLNullableType> {
  if (!isNonNullType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Non-Null type.`);
  }
  return type;
}

/** These types may be used as input types for arguments and directives. */
export type GraphQLNullableInputType =
  | GraphQLNamedInputType
  | GraphQLList<GraphQLInputType>;

/** These types may be used as input types for arguments and directives. */
export type GraphQLInputType =
  | GraphQLNullableInputType
  | GraphQLNonNull<GraphQLNullableInputType>;

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
export type GraphQLNullableOutputType =
  | GraphQLNamedOutputType
  | GraphQLList<GraphQLOutputType>;

/** These types may be used as output types as the result of fields. */
export type GraphQLOutputType =
  | GraphQLNullableOutputType
  | GraphQLNonNull<GraphQLNullableOutputType>;

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
 *
 * Example:
 *
 * ```ts
 * const PersonType = new GraphQLObjectType({
 *   name: 'Person',
 *   fields: () => ({
 *     parents: { type: new GraphQLList(PersonType) },
 *     children: { type: new GraphQLList(PersonType) },
 *   })
 * })
 * ```
 * @typeParam T - The GraphQL type wrapped by this list type.
 */
export class GraphQLList<
  T extends GraphQLType,
> implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLList instances.
   * @private
   */
  readonly __kind: symbol;
  /** The type wrapped by this list or non-null type. */
  readonly ofType: T;
  // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
  declare private readonly __GraphQLListTypeBrand: never;

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
    this.__kind = listSymbol;
    this.ofType = ofType;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
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
 *
 * Example:
 *
 * ```ts
 * const RowType = new GraphQLObjectType({
 *   name: 'Row',
 *   fields: () => ({
 *     id: { type: new GraphQLNonNull(GraphQLString) },
 *   })
 * })
 * ```
 * Note: the enforcement of non-nullability occurs within the executor.
 * @typeParam T - The nullable GraphQL type wrapped by this non-null type.
 */
export class GraphQLNonNull<
  T extends GraphQLNullableType,
> implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLNonNull instances.
   * @private
   */
  readonly __kind: symbol;
  /** The type wrapped by this list or non-null type. */
  readonly ofType: T;
  // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
  declare private readonly __GraphQLNonNullTypeBrand: never;

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
    this.__kind = nonNullSymbol;
    this.ofType = ofType;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
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
  | GraphQLNonNull<GraphQLNullableType>;

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
export type GraphQLNullableType = GraphQLNamedType | GraphQLList<GraphQLType>;

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
/**
 * Returns the nullable type after removing one non-null wrapper.
 * @internal
 */
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
/**
 * Returns the named type after unwrapping all list and non-null wrappers.
 * @internal
 */
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
 * An interface for all Schema Elements.
 *
 * @internal
 */

export interface GraphQLSchemaElement {
  toString: () => string;
  toJSON: () => string;
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
  [attributeName: string | symbol]: unknown;
}

/**
 * Scalar Type Definition
 *
 * Scalar types define the leaf values of a GraphQL response and the input
 * values accepted by arguments and input object fields. A scalar type has a
 * name and coercion functions that validate and convert runtime values and
 * GraphQL literals.
 *
 * If a type's coerceOutputValue function returns `null` or does not return a
 * value (i.e. it returns `undefined`) then an error will be raised and a
 * `null` value will be returned in the response. Prefer validating inputs
 * before execution so clients receive input diagnostics before result coercion
 * fails.
 *
 * Example:
 *
 * ```ts
 * import { GraphQLScalarType, Kind } from 'graphql';
 *
 * const ensureOdd = (value) => {
 *   if (!Number.isFinite(value)) {
 *     throw new Error(
 *       `Scalar "Odd" cannot represent "${value}" since it is not a finite number.`,
 *     );
 *   }
 *
 *   if (value % 2 === 0) {
 *     throw new Error(`Scalar "Odd" cannot represent "${value}" since it is even.`);
 *   }
 *
 *   return value;
 * };
 *
 * const OddType = new GraphQLScalarType({
 *   name: 'Odd',
 *   coerceOutputValue: (value) => {
 *     return ensureOdd(value);
 *   },
 *   coerceInputValue: (value) => {
 *     return ensureOdd(value);
 *   },
 *   valueToLiteral: (value) => {
 *     return { kind: Kind.INT, value: String(ensureOdd(value)) };
 *   }
 * });
 * ```
 *
 * Custom scalar behavior is defined via the following functions:
 *
 *  - coerceOutputValue(value): Implements "Result Coercion". Given an internal value,
 *    produces an external value valid for this type. Returns undefined or
 *    throws an error to indicate invalid values.
 *
 *  - coerceInputValue(value): Implements "Input Coercion" for values. Given an
 *    external value (for example, variable values), produces an internal value
 *    valid for this type. Returns undefined or throws an error to indicate
 *    invalid values.
 *
 *  - coerceInputLiteral(ast): Implements "Input Coercion" for constant literals.
 *    Given a GraphQL literal (AST) (for example, an argument value), produces
 *    an internal value valid for this type. Returns undefined or throws an
 *    error to indicate invalid values.
 *
 *  - valueToLiteral(value): Converts an external value to a GraphQL
 *    literal (AST). Returns undefined or throws an error to indicate
 *    invalid values.
 *
 *  Deprecated, to be removed in v18:
 *
 *  - serialize(value): Implements "Result Coercion". Renamed to
 *    `coerceOutputValue()`.
 *
 *  - parseValue(value): Implements "Input Coercion" for values. Renamed to
 *    `coerceInputValue()`.
 *
 *  - parseLiteral(ast): Implements "Input Coercion" for literals including
 *    non-specified replacement of variables embedded within complex scalars.
 *    Replaced by the combination of the `replaceVariables()` utility and the
 *    `coerceInputLiteral()` method.
 * @typeParam TInternal - Internal runtime representation for this scalar.
 * @typeParam TExternal - External representation accepted from or returned to callers.
 */
export class GraphQLScalarType<
  TInternal = unknown,
  TExternal = TInternal,
> implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLScalarType instances.
   * @private
   */
  readonly __kind: symbol;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** URL identifying the behavior specified for this custom scalar. */
  specifiedByURL: Maybe<string>;
  /**
   * Legacy serializer used to convert internal values for response output.
   * @deprecated use `coerceOutputValue()` instead, `serialize()` will be removed in v18
   */
  serialize: GraphQLScalarSerializer<TExternal>;
  /**
   * Legacy parser used to convert externally provided input values.
   * @deprecated use `coerceInputValue()` instead, `parseValue()` will be removed in v18
   */
  parseValue: GraphQLScalarValueParser<TInternal>;
  /**
   * Legacy parser used to convert externally provided input literals.
   * @deprecated use `replaceVariables()` and `coerceInputLiteral()` instead, `parseLiteral()` will be removed in v18
   */
  parseLiteral: GraphQLScalarLiteralParser<TInternal>;
  /** Coercer used to convert internal scalar values for response output. */
  coerceOutputValue: GraphQLScalarOutputValueCoercer<TExternal>;
  /** Coercer used to convert externally provided scalar input values. */
  coerceInputValue: GraphQLScalarInputValueCoercer<TInternal>;
  /** Coercer used to convert GraphQL scalar input literals. */
  coerceInputLiteral: GraphQLScalarInputLiteralCoercer<TInternal> | undefined;
  /** Converter used to produce GraphQL literals from runtime input values. */
  valueToLiteral: GraphQLScalarValueToLiteral | undefined;
  /** Extension fields to include in the formatted result. */
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
   *   coerceOutputValue: (value) => {
   *     if (typeof value !== 'number' || value % 2 === 0) {
   *       throw new TypeError('Odd can only produce odd numbers.');
   *     }
   *     return value;
   *   },
   *   coerceInputValue: (value) => {
   *     if (typeof value !== 'number' || value % 2 === 0) {
   *       throw new TypeError('Odd can only accept odd numbers.');
   *     }
   *     return value;
   *   },
   *   coerceInputLiteral: (ast) => {
   *     if (ast.kind !== Kind.INT) {
   *       throw new TypeError('Odd can only accept integer literals.');
   *     }
   *     const value = Number(ast.value);
   *     if (value % 2 === 0) {
   *       throw new TypeError('Odd can only accept odd integer literals.');
   *     }
   *     return value;
   *   },
   *   valueToLiteral: (value) => {
   *     return { kind: Kind.INT, value: String(ensureOdd(value)) };
   *   },
   *   extensions: { numeric: true },
   *   astNode: document.definitions[0],
   *   extensionASTNodes: [ document.definitions[1] ],
   * });
   *
   * Odd.description; // => 'Odd integer values.'
   * Odd.specifiedByURL; // => 'https://example.com/odd'
   * Odd.coerceOutputValue(3); // => 3
   * Odd.coerceInputValue(5); // => 5
   * Odd.extensions; // => { numeric: true }
   * ```
   */
  constructor(config: Readonly<GraphQLScalarTypeConfig<TInternal, TExternal>>) {
    this.__kind = scalarSymbol;
    this.name = assertName(config.name);
    this.description = config.description;
    this.specifiedByURL = config.specifiedByURL;
    this.serialize =
      config.serialize ??
      config.coerceOutputValue ??
      (identityFunc as GraphQLScalarSerializer<TExternal>);
    this.parseValue =
      config.parseValue ??
      config.coerceInputValue ??
      (identityFunc as GraphQLScalarValueParser<TInternal>);
    this.parseLiteral =
      config.parseLiteral ??
      ((node, variables) =>
        this.coerceInputValue(valueFromASTUntyped(node, variables)));
    this.coerceOutputValue = config.coerceOutputValue ?? this.serialize;
    this.coerceInputValue = config.coerceInputValue ?? this.parseValue;
    this.coerceInputLiteral = config.coerceInputLiteral;
    this.valueToLiteral = config.valueToLiteral;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    if (config.parseLiteral) {
      devAssert(
        typeof config.parseValue === 'function' &&
          typeof config.parseLiteral === 'function',
        `${this.name} must provide both "parseValue" and "parseLiteral" functions.`,
      );
    }

    if (config.coerceInputLiteral) {
      devAssert(
        typeof config.coerceInputValue === 'function' &&
          typeof config.coerceInputLiteral === 'function',
        `${this.name} must provide both "coerceInputValue" and "coerceInputLiteral" functions.`,
      );
    }
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
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
      coerceOutputValue: this.coerceOutputValue,
      coerceInputValue: this.coerceInputValue,
      coerceInputLiteral: this.coerceInputLiteral,
      valueToLiteral: this.valueToLiteral,
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
 * @typeParam TExternal - External representation accepted from or returned to callers.
 * @deprecated Use GraphQLScalarOutputValueCoercer instead. Will be removed in v18.
 */
export type GraphQLScalarSerializer<TExternal> = (
  outputValue: unknown,
) => TExternal;

/**
 * Function used to coerce internal scalar values for response output.
 * @typeParam TExternal - External representation accepted from or returned to callers.
 */
export type GraphQLScalarOutputValueCoercer<TExternal> = (
  outputValue: unknown,
) => TExternal;

/**
 * Parses a runtime input value as a scalar input value.
 * @typeParam TInternal - Internal runtime representation for this scalar.
 * @deprecated Use GraphQLScalarInputValueCoercer instead. Will be removed in v18.
 */
export type GraphQLScalarValueParser<TInternal> = (
  inputValue: unknown,
) => TInternal;

/**
 * Function used to coerce externally provided scalar input values.
 * @typeParam TInternal - Internal runtime representation for this scalar.
 */
export type GraphQLScalarInputValueCoercer<TInternal> = (
  inputValue: unknown,
) => TInternal;

/**
 * Parses a GraphQL value literal as a scalar input value.
 * @typeParam TInternal - Internal runtime representation for this scalar.
 * @deprecated Use GraphQLScalarInputLiteralCoercer instead. Will be removed in v18.
 */
export type GraphQLScalarLiteralParser<TInternal> = (
  valueNode: ValueNode,
  variables: Maybe<ObjMap<unknown>>,
) => Maybe<TInternal>;

/**
 * Function used to coerce GraphQL scalar input literals.
 * @typeParam TInternal - Internal runtime representation for this scalar.
 */
export type GraphQLScalarInputLiteralCoercer<TInternal> = (
  valueNode: ConstValueNode,
) => Maybe<TInternal>;

/** @internal */
export type GraphQLScalarValueToLiteral = (
  inputValue: unknown,
) => ConstValueNode | undefined;

/**
 * Configuration used to construct a GraphQLScalarType.
 * @typeParam TInternal - Internal runtime representation for this scalar.
 * @typeParam TExternal - External representation accepted from or returned to callers.
 */
export interface GraphQLScalarTypeConfig<TInternal, TExternal> {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** URL identifying the behavior specified for this custom scalar. */
  specifiedByURL?: Maybe<string>;
  /**
   * Legacy serializer used to convert internal values for response output.
   * @deprecated use `coerceOutputValue()` instead, `serialize()` will be removed in v18
   */
  serialize?: GraphQLScalarSerializer<TExternal> | undefined;
  /**
   * Legacy parser used to convert externally provided input values.
   * @deprecated use `coerceInputValue()` instead, `parseValue()` will be removed in v18
   */
  parseValue?: GraphQLScalarValueParser<TInternal> | undefined;
  /**
   * Legacy parser used to convert externally provided input literals.
   * @deprecated use `replaceVariables()` and `coerceInputLiteral()` instead, `parseLiteral()` will be removed in v18
   */
  parseLiteral?: GraphQLScalarLiteralParser<TInternal> | undefined;
  /** Coerces an internal value to include in a response. */
  coerceOutputValue?: GraphQLScalarOutputValueCoercer<TExternal> | undefined;
  /** Coerces an externally provided value to use as an input. */
  coerceInputValue?: GraphQLScalarInputValueCoercer<TInternal> | undefined;
  /** Coerces an externally provided const literal value to use as an input. */
  coerceInputLiteral?: GraphQLScalarInputLiteralCoercer<TInternal> | undefined;
  /** Translates an externally provided value to a literal (AST). */
  valueToLiteral?: GraphQLScalarValueToLiteral | undefined;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<Readonly<GraphQLScalarTypeExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<ScalarTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<ScalarTypeExtensionNode>>;
}

/** @internal */
export interface GraphQLScalarTypeNormalizedConfig<
  TInternal,
  TExternal,
> extends GraphQLScalarTypeConfig<TInternal, TExternal> {
  serialize: GraphQLScalarSerializer<TExternal>;
  parseValue: GraphQLScalarValueParser<TInternal>;
  parseLiteral: GraphQLScalarLiteralParser<TInternal>;
  coerceOutputValue: GraphQLScalarOutputValueCoercer<TExternal>;
  coerceInputValue: GraphQLScalarInputValueCoercer<TInternal>;
  coerceInputLiteral: GraphQLScalarInputLiteralCoercer<TInternal> | undefined;
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
  [attributeName: string | symbol]: unknown;
}

/**
 * Object Type Definition
 *
 * Almost all of the GraphQL types you define will be object types. Object types
 * have a name, but most importantly describe their fields.
 *
 * Example:
 *
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
 *
 * When two types need to refer to each other, or a type needs to refer to
 * itself in a field, you can use a function expression (aka a closure or a
 * thunk) to supply the fields lazily.
 *
 * Example:
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
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 * @typeParam TAbstract - Runtime value type used for abstract type resolution.
 */
export class GraphQLObjectType<
  TSource = any,
  TContext = any,
  TAbstract = any,
> implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLObjectType instances.
   * @private
   */
  readonly __kind: typeof objectSymbol = objectSymbol;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Predicate used to determine whether a runtime value belongs to this object type. */
  isTypeOf: Maybe<GraphQLIsTypeOfFn<TAbstract, TContext>>;
  /** Extension fields to include in the formatted result. */
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
   *           default: { value: 'short' },
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
   * User.getFields().name.args[0].default.value; // => 'short'
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
  constructor(
    config: Readonly<GraphQLObjectTypeConfig<TSource, TContext, TAbstract>>,
  ) {
    this.__kind = objectSymbol;
    this.name = assertName(config.name);
    this.description = config.description;
    this.isTypeOf = config.isTypeOf;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];
    this._fields = (defineFieldMap<TSource, TContext>).bind(
      undefined,
      this,
      config.fields,
    );
    this._interfaces = defineInterfaces.bind(undefined, config.interfaces);
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
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
  toConfig(): GraphQLObjectTypeNormalizedConfig<TSource, TContext, TAbstract> {
    return {
      name: this.name,
      description: this.description,
      interfaces: this.getInterfaces(),
      fields: mapValue(this.getFields(), (field) => field.toConfig()),
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
  interfaces: Maybe<ThunkReadonlyArray<GraphQLInterfaceType>>,
): ReadonlyArray<GraphQLInterfaceType> {
  return resolveReadonlyArrayThunk(interfaces ?? []);
}

function defineFieldMap<TSource, TContext>(
  parentType:
    | GraphQLObjectType<TSource, TContext>
    | GraphQLInterfaceType<TSource, TContext>,
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>,
): GraphQLFieldMap<TSource, TContext> {
  const fieldMap = resolveObjMapThunk(fields);

  return mapValue(
    fieldMap,
    (fieldConfig, fieldName) =>
      new GraphQLField(parentType, fieldName, fieldConfig),
  );
}

/**
 * Configuration used to construct a GraphQLObjectType.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 * @typeParam TAbstract - Runtime value type used for abstract type resolution.
 */
export interface GraphQLObjectTypeConfig<
  TSource,
  TContext,
  TAbstract = unknown,
> {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Interfaces implemented by this object or interface type. */
  interfaces?: ThunkReadonlyArray<GraphQLInterfaceType> | undefined;
  /** Fields declared by this object, interface, input object, or literal. */
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  /** Predicate used to determine whether a runtime value belongs to this object type. */
  isTypeOf?: Maybe<GraphQLIsTypeOfFn<TAbstract, TContext>>;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<Readonly<GraphQLObjectTypeExtensions<TSource, TContext>>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<ObjectTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<ObjectTypeExtensionNode>>;
}

/** @internal */
export interface GraphQLObjectTypeNormalizedConfig<
  TSource,
  TContext,
  TAbstract = unknown,
> extends GraphQLObjectTypeConfig<TSource, TContext, TAbstract> {
  interfaces: ReadonlyArray<GraphQLInterfaceType>;
  fields: GraphQLFieldNormalizedConfigMap<TSource, TContext>;
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
 * @typeParam TAbstract - Runtime value type used for abstract type resolution.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export type GraphQLIsTypeOfFn<TAbstract, TContext> = (
  value: TAbstract,
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

/** Utilities available from resolver info for tracking asynchronous work. */
export interface GraphQLResolveInfoHelpers {
  /**
   * Promise.all wrapper that allows rejected branches to be tracked
   * as execution async work.
   *
   * Intended use: return or await this promise from resolver work.
   * Un-awaited async side effects are an anti-pattern:
   *
   *   const { promiseAll } = info.getAsyncHelpers();
   *   promiseAll([someAsyncWork(), someOtherAsyncWork()]).catch(() => undefined);
   *
   * In that anti-pattern, tracking starts only after rejection (on a
   * later microtask), so this work is not guaranteed to delay
   * `hooks.asyncWorkFinished`.
   *
   * Use `track(...)` for un-awaited async side effects:
   *
   *   const { track } = info.getAsyncHelpers();
   *   track([
   *     someAsyncWork().catch(() => undefined),
   *     someOtherAsyncWork().catch(() => undefined)
   *   ]);
   */
  readonly promiseAll: <T>(
    values: ReadonlyArray<PromiseLike<T> | T>,
  ) => Promise<Array<T>>;
  /** Tracks asynchronous work that should delay execution completion hooks. */
  readonly track: (maybePromises: ReadonlyArray<unknown>) => void;
}

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
  /**
   * Coerced variable values and source metadata for this operation. Resolver
   * code that needs runtime variable values should read `variableValues.coerced`.
   */
  readonly variableValues: VariableValues;
  /** Returns the AbortSignal supplied for this execution, if any. */
  readonly getAbortSignal: () => AbortSignal | undefined;
  /** Returns helper functions for tracking asynchronous resolver work. */
  readonly getAsyncHelpers: () => GraphQLResolveInfoHelpers;
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
  [attributeName: string | symbol]: unknown;
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
  args?: GraphQLFieldConfigArgumentMap | undefined;
  /** Resolver function used to produce this field value. */
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs> | undefined;
  /** Resolver function used to create a subscription event stream for this field. */
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs> | undefined;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason?: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<
    Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>
  >;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<FieldDefinitionNode>;
}

/** @internal */
export interface GraphQLFieldNormalizedConfig<
  TSource,
  TContext,
  TArgs = any,
> extends GraphQLFieldConfig<TSource, TContext, TArgs> {
  args: GraphQLFieldNormalizedConfigArgumentMap;
  extensions: Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>;
}

/** A map of argument names to argument configuration objects. */
export type GraphQLFieldConfigArgumentMap = ObjMap<GraphQLArgumentConfig>;

/** @internal */
export type GraphQLFieldNormalizedConfigArgumentMap =
  ObjMap<GraphQLArgumentNormalizedConfig>;

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLArgumentExtensions {
  [attributeName: string | symbol]: unknown;
}

/** Configuration used to define a GraphQL argument. */
export interface GraphQLArgumentConfig {
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLInputType;
  /**
   * Legacy default value for this argument.
   * @deprecated use `default` instead, `defaultValue` will be removed in v18
   */
  defaultValue?: unknown;
  /** Default value represented as either a runtime value or a GraphQL literal. */
  default?: GraphQLDefaultInput | undefined;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason?: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<Readonly<GraphQLArgumentExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<InputValueDefinitionNode>;
}

/** @internal */
export interface GraphQLArgumentNormalizedConfig extends GraphQLArgumentConfig {
  default: GraphQLDefaultInput | undefined;
  extensions: Readonly<GraphQLArgumentExtensions>;
}

/**
 * A map of field names to field configuration objects.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export type GraphQLFieldConfigMap<TSource, TContext> = ObjMap<
  GraphQLFieldConfig<TSource, TContext>
>;

/** @internal */
export type GraphQLFieldNormalizedConfigMap<TSource, TContext> = ObjMap<
  GraphQLFieldNormalizedConfig<TSource, TContext>
>;

/**
 * A resolved GraphQL field definition.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 * @typeParam TArgs - Argument object type passed to resolvers.
 */
export class GraphQLField<
  TSource = any,
  TContext = any,
  TArgs = any,
> implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLField instances.
   * @private
   */
  readonly __kind: symbol;
  /** Object or interface type that owns this field, if known. */
  parentType:
    | GraphQLObjectType<TSource, TContext>
    | GraphQLInterfaceType<TSource, TContext>
    | undefined;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLOutputType;
  /** Arguments accepted by this field or directive. */
  args: ReadonlyArray<GraphQLArgument>;
  /** Resolver function used to produce this field value. */
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs> | undefined;
  /** Resolver function used to create a subscription event stream for this field. */
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs> | undefined;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions: Readonly<GraphQLFieldExtensions<TSource, TContext, TArgs>>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<FieldDefinitionNode>;

  /**
   * Creates a resolved GraphQL field definition.
   * @param parentType - Object or interface type that owns this field, if known.
   * @param name - Field name.
   * @param config - Field configuration.
   * @example
   * ```ts
   * import { parse } from 'graphql/language';
   * import { GraphQLField, GraphQLObjectType, GraphQLString } from 'graphql/type';
   *
   * const Query = new GraphQLObjectType({ name: 'Query', fields: {} });
   * const document = parse('type Query { greeting: String }');
   * const fieldNode = document.definitions[0].fields[0];
   * const field = new GraphQLField(Query, 'greeting', {
   *   description: 'Greeting text.',
   *   type: GraphQLString,
   *   args: {
   *     name: { type: GraphQLString, default: { value: 'world' } },
   *   },
   *   resolve: (_source, { name }) => `Hello, ${name}!`,
   *   subscribe: async function* () {
   *     yield { greeting: 'Hello!' };
   *   },
   *   deprecationReason: 'Use hello.',
   *   extensions: { cacheSeconds: 60 },
   *   astNode: fieldNode,
   * });
   *
   * field.parentType; // => Query
   * field.name; // => 'greeting'
   * field.args[0].default.value; // => 'world'
   * typeof field.subscribe; // => 'function'
   * field.deprecationReason; // => 'Use hello.'
   * field.astNode; // => fieldNode
   * ```
   */
  constructor(
    parentType:
      | GraphQLObjectType<TSource, TContext>
      | GraphQLInterfaceType<TSource, TContext>
      | undefined,
    name: string,
    config: GraphQLFieldConfig<TSource, TContext, TArgs>,
  ) {
    this.__kind = fieldSymbol;
    this.parentType = parentType;
    this.name = assertName(name);
    this.description = config.description;
    this.type = config.type;

    const argsConfig = config.args;
    this.args = argsConfig
      ? Object.entries(argsConfig).map(
          ([argName, argConfig]) =>
            new GraphQLArgument(this, argName, argConfig),
        )
      : [];

    this.resolve = config.resolve;
    this.subscribe = config.subscribe;
    this.deprecationReason = config.deprecationReason;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
    return 'GraphQLField';
  }

  /**
   * Returns a normalized configuration object for this field.
   * @returns A configuration object that can be used to recreate this field.
   * @example
   * ```ts
   * import { GraphQLField, GraphQLObjectType, GraphQLString } from 'graphql/type';
   *
   * const Query = new GraphQLObjectType({ name: 'Query', fields: {} });
   * const field = new GraphQLField(Query, 'greeting', {
   *   type: GraphQLString,
   *   extensions: { cacheSeconds: 60 },
   * });
   *
   * field.toConfig().type; // => GraphQLString
   * field.toConfig().extensions; // => { cacheSeconds: 60 }
   * ```
   */
  toConfig(): GraphQLFieldNormalizedConfig<TSource, TContext, TArgs> {
    return {
      description: this.description,
      type: this.type,
      args: keyValMap(
        this.args,
        (arg) => arg.name,
        (arg) => arg.toConfig(),
      ),
      resolve: this.resolve,
      subscribe: this.subscribe,
      deprecationReason: this.deprecationReason,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }

  /**
   * Returns this field as a schema coordinate string.
   * @returns The field coordinate.
   * @example
   * ```ts
   * import { GraphQLField, GraphQLObjectType, GraphQLString } from 'graphql/type';
   *
   * const Query = new GraphQLObjectType({ name: 'Query', fields: {} });
   * const field = new GraphQLField(Query, 'greeting', { type: GraphQLString });
   *
   * field.toString(); // => 'Query.greeting'
   * ```
   */
  toString(): string {
    return `${this.parentType ?? '<meta>'}.${this.name}`;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The field coordinate.
   * @example
   * ```ts
   * import { GraphQLField, GraphQLObjectType, GraphQLString } from 'graphql/type';
   *
   * const Query = new GraphQLObjectType({ name: 'Query', fields: {} });
   * const field = new GraphQLField(Query, 'greeting', { type: GraphQLString });
   *
   * JSON.stringify(field); // => '"Query.greeting"'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

/** A resolved GraphQL argument definition. */
export class GraphQLArgument implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLArgument instances.
   * @private
   */
  readonly __kind: symbol;
  /** Field or directive that owns this argument. */
  parent: GraphQLField | GraphQLDirective;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLInputType;
  /**
   * Legacy default value used when no explicit value is supplied.
   * @deprecated use `default` instead, `defaultValue` will be removed in v18
   */
  defaultValue: unknown;
  /** Default value represented as either a runtime value or a GraphQL literal. */
  default: GraphQLDefaultInput | undefined;
  /**
   * Cached coerced default value.
   * @private
   */
  _memoizedCoercedDefaultValue: unknown;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions: Readonly<GraphQLArgumentExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<InputValueDefinitionNode>;

  /**
   * Creates a resolved GraphQL argument definition.
   * @param parent - Field or directive that owns this argument.
   * @param name - Argument name.
   * @param config - Argument configuration.
   * @example
   * ```ts
   * import {
   *   GraphQLArgument,
   *   GraphQLField,
   *   GraphQLObjectType,
   *   GraphQLString,
   * } from 'graphql/type';
   *
   * const Query = new GraphQLObjectType({ name: 'Query', fields: {} });
   * const field = new GraphQLField(Query, 'greeting', { type: GraphQLString });
   * const arg = new GraphQLArgument(field, 'name', {
   *   type: GraphQLString,
   *   default: { value: 'world' },
   * });
   *
   * arg.parent; // => field
   * arg.name; // => 'name'
   * arg.default.value; // => 'world'
   * ```
   */
  constructor(
    parent: GraphQLField | GraphQLDirective,
    name: string,
    config: GraphQLArgumentConfig,
  ) {
    this.__kind = argumentSymbol;
    this.parent = parent;
    this.name = assertName(name);
    this.description = config.description;
    this.type = config.type;
    this.defaultValue = config.defaultValue;
    this.default = config.default;
    this._memoizedCoercedDefaultValue = undefined;
    this.deprecationReason = config.deprecationReason;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
    return 'GraphQLArgument';
  }

  /**
   * Returns a normalized configuration object for this argument.
   * @returns A configuration object that can be used to recreate this argument.
   * @example
   * ```ts
   * import {
   *   GraphQLArgument,
   *   GraphQLField,
   *   GraphQLObjectType,
   *   GraphQLString,
   * } from 'graphql/type';
   *
   * const Query = new GraphQLObjectType({ name: 'Query', fields: {} });
   * const field = new GraphQLField(Query, 'greeting', { type: GraphQLString });
   * const arg = new GraphQLArgument(field, 'name', {
   *   type: GraphQLString,
   *   default: { value: 'world' },
   * });
   *
   * arg.toConfig().default.value; // => 'world'
   * ```
   */
  toConfig(): GraphQLArgumentNormalizedConfig {
    return {
      description: this.description,
      type: this.type,
      defaultValue: this.defaultValue,
      default: this.default,
      deprecationReason: this.deprecationReason,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }

  /**
   * Returns this argument as a schema coordinate string.
   * @returns The argument coordinate.
   * @example
   * ```ts
   * import {
   *   GraphQLArgument,
   *   GraphQLField,
   *   GraphQLObjectType,
   *   GraphQLString,
   * } from 'graphql/type';
   *
   * const Query = new GraphQLObjectType({ name: 'Query', fields: {} });
   * const field = new GraphQLField(Query, 'greeting', { type: GraphQLString });
   * const arg = new GraphQLArgument(field, 'name', { type: GraphQLString });
   *
   * arg.toString(); // => 'Query.greeting(name:)'
   * ```
   */
  toString(): string {
    return `${this.parent}(${this.name}:)`;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The argument coordinate.
   * @example
   * ```ts
   * import {
   *   GraphQLArgument,
   *   GraphQLField,
   *   GraphQLObjectType,
   *   GraphQLString,
   * } from 'graphql/type';
   *
   * const Query = new GraphQLObjectType({ name: 'Query', fields: {} });
   * const field = new GraphQLField(Query, 'greeting', { type: GraphQLString });
   * const arg = new GraphQLArgument(field, 'name', { type: GraphQLString });
   *
   * JSON.stringify(arg); // => '"Query.greeting(name:)"'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

/**
 * Returns true when the argument is non-null and has no default value.
 * @param arg - The argument definition to inspect.
 * @returns True when the argument is non-null and has no default value.
 * @example
 * ```ts
 * import {
 *   GraphQLArgument,
 *   GraphQLField,
 *   GraphQLInt,
 *   GraphQLNonNull,
 *   GraphQLObjectType,
 *   GraphQLString,
 *   isRequiredArgument,
 * } from 'graphql/type';
 *
 * const Query = new GraphQLObjectType({ name: 'Query', fields: {} });
 * const field = new GraphQLField(Query, 'reviews', { type: GraphQLString });
 * const requiredArgument = new GraphQLArgument(field, 'id', {
 *   type: new GraphQLNonNull(GraphQLInt),
 * });
 * const optionalArgument = new GraphQLArgument(field, 'name', {
 *   type: GraphQLString,
 * });
 * const argumentWithDefault = new GraphQLArgument(field, 'limit', {
 *   type: new GraphQLNonNull(GraphQLInt),
 *   default: { value: 10 },
 * });
 *
 * isRequiredArgument(requiredArgument); // => true
 * isRequiredArgument(optionalArgument); // => false
 * isRequiredArgument(argumentWithDefault); // => false
 * ```
 */
export function isRequiredArgument(
  arg: GraphQLArgument | GraphQLVariableSignature,
): boolean {
  return (
    isNonNullType(arg.type) &&
    arg.default === undefined &&
    arg.defaultValue === undefined
  );
}

/**
 * A map of field names to resolved field definitions.
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export type GraphQLFieldMap<TSource, TContext> = ObjMap<
  GraphQLField<TSource, TContext>
>;

/** Default input represented as either a runtime value or a GraphQL literal. */
export type GraphQLDefaultInput =
  | {
      /** Runtime default value. */
      value: unknown;
      /** GraphQL literal default value is not provided in this variant. */
      literal?: never;
    }
  | {
      /** GraphQL literal default value. */
      literal: ConstValueNode;
      /** Runtime default value is not provided in this variant. */
      value?: never;
    };

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLInterfaceTypeExtensions {
  [attributeName: string | symbol]: unknown;
}

/**
 * Interface Type Definition
 *
 * When a field can return one of a heterogeneous set of types, a Interface type
 * is used to describe what types are possible, what fields are in common across
 * all types, as well as a function to determine which type is actually used
 * when the field is resolved.
 *
 * Example:
 *
 * ```ts
 * const EntityType = new GraphQLInterfaceType({
 *   name: 'Entity',
 *   fields: {
 *     name: { type: GraphQLString }
 *   }
 * });
 * ```
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export class GraphQLInterfaceType<
  TSource = any,
  TContext = any,
> implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLInterfaceType instances.
   * @private
   */
  readonly __kind: symbol;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Function that resolves the concrete object type for this abstract type. */
  resolveType: Maybe<GraphQLTypeResolver<TSource, TContext>>;
  /** Extension fields to include in the formatted result. */
  extensions: Readonly<GraphQLInterfaceTypeExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<InterfaceTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes: ReadonlyArray<InterfaceTypeExtensionNode>;

  private _fields: ThunkObjMap<GraphQLField<TSource, TContext>>;
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
  constructor(config: Readonly<GraphQLInterfaceTypeConfig<TSource, TContext>>) {
    this.__kind = interfaceSymbol;
    this.name = assertName(config.name);
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];
    this._fields = (defineFieldMap<TSource, TContext>).bind(
      undefined,
      this,
      config.fields,
    );
    this._interfaces = defineInterfaces.bind(undefined, config.interfaces);
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
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
  toConfig(): GraphQLInterfaceTypeNormalizedConfig<TSource, TContext> {
    return {
      name: this.name,
      description: this.description,
      interfaces: this.getInterfaces(),
      fields: mapValue(this.getFields(), (field) => field.toConfig()),
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
  interfaces?: ThunkReadonlyArray<GraphQLInterfaceType> | undefined;
  /** Fields declared by this object, interface, input object, or literal. */
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  /**
   * Optionally provide a custom type resolver function. If one is not provided,
   * the default implementation will call `isTypeOf` on each implementing
   * Object type.
   */
  resolveType?: Maybe<GraphQLTypeResolver<TSource, TContext>>;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<Readonly<GraphQLInterfaceTypeExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<InterfaceTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<InterfaceTypeExtensionNode>>;
}

/** @internal */
export interface GraphQLInterfaceTypeNormalizedConfig<
  TSource,
  TContext,
> extends GraphQLInterfaceTypeConfig<TSource, TContext> {
  interfaces: ReadonlyArray<GraphQLInterfaceType>;
  fields: GraphQLFieldNormalizedConfigMap<TSource, TContext>;
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
  [attributeName: string | symbol]: unknown;
}

/**
 * Union Type Definition
 *
 * When a field can return one of a heterogeneous set of types, a Union type
 * is used to describe what types are possible as well as providing a function
 * to determine which type is actually used when the field is resolved.
 *
 * Example:
 *
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
 * @typeParam TSource - Source object type passed to resolvers.
 * @typeParam TContext - Context object type passed to resolvers.
 */
export class GraphQLUnionType<
  TSource = any,
  TContext = any,
> implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLUnionType instances.
   * @private
   */
  readonly __kind: symbol;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Function that resolves the concrete object type for this abstract type. */
  resolveType: Maybe<GraphQLTypeResolver<TSource, TContext>>;
  /** Extension fields to include in the formatted result. */
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
  constructor(config: Readonly<GraphQLUnionTypeConfig<TSource, TContext>>) {
    this.__kind = unionSymbol;
    this.name = assertName(config.name);
    this.description = config.description;
    this.resolveType = config.resolveType;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._types = defineTypes.bind(undefined, config.types);
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
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
  toConfig(): GraphQLUnionTypeNormalizedConfig<TSource, TContext> {
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
  types: ThunkReadonlyArray<GraphQLObjectType>,
): ReadonlyArray<GraphQLObjectType> {
  return resolveReadonlyArrayThunk(types);
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
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<Readonly<GraphQLUnionTypeExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<UnionTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<UnionTypeExtensionNode>>;
}

/** @internal */
export interface GraphQLUnionTypeNormalizedConfig<
  TSource,
  TContext,
> extends GraphQLUnionTypeConfig<TSource, TContext> {
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
  [attributeName: string | symbol]: unknown;
}

/**
 * Enum Type Definition
 *
 * Enum types define leaf values whose serialized form is one of a fixed set
 * of GraphQL enum names. Internally, enum values can map to any runtime value,
 * often integers.
 *
 * Example:
 *
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
export class GraphQLEnumType /* <T> */ implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLEnumType instances.
   * @private
   */
  readonly __kind: symbol;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions: Readonly<GraphQLEnumTypeExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<EnumTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;

  private _values:
    | ReadonlyArray<GraphQLEnumValue /* <T> */>
    | (() => ReadonlyArray<GraphQLEnumValue>) /* <T> */;

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
   * Episode.coerceOutputValue(5); // => 'EMPIRE'
   * Episode.coerceInputValue('JEDI'); // => 6
   * Episode.getValue('JEDI').deprecationReason; // => 'Use RETURN_OF_THE_JEDI.'
   * Episode.extensions; // => { catalog: 'films' }
   * ```
   */
  constructor(config: Readonly<GraphQLEnumTypeConfig /* <T> */>) {
    this.__kind = enumSymbol;
    this.name = assertName(config.name);
    this.description = config.description;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];

    this._values = defineEnumValues.bind(undefined, this, config.values);
    this._valueLookup = null;
    this._nameLookup = null;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
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
      this._values = this._values();
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
    this._nameLookup ??= keyMap(this.getValues(), (value) => value.name);
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
   * @deprecated use `coerceOutputValue()` instead, `serialize()` will be removed in v18
   */
  serialize(outputValue: unknown /* T */): Maybe<string> {
    return this.coerceOutputValue(outputValue);
  }

  /**
   * Coerces a runtime enum value to a GraphQL enum name.
   * @param outputValue - Runtime enum value to coerce.
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
   * RGB.coerceOutputValue(1); // => 'GREEN'
   * RGB.coerceOutputValue(3); // throws an error
   * ```
   */
  coerceOutputValue(outputValue: unknown /* T */): Maybe<string> {
    this._valueLookup ??= new Map(
      this.getValues().map((enumValue) => [enumValue.value, enumValue]),
    );
    const enumValue = this._valueLookup.get(outputValue);
    if (enumValue === undefined) {
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent value: ${inspect(outputValue)}`,
      );
    }
    return enumValue.name;
  }

  /**
   * Legacy enum parser for externally provided input values.
   * @param inputValue - External enum name to parse.
   * @param hideSuggestions - Whether suggestion text should be omitted from errors.
   * @returns The internal runtime value for the enum name.
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
   * RGB.parseValue('PURPLE', true); // throws an error
   * ```
   * @deprecated use `coerceInputValue()` instead, `parseValue()` will be removed in v18
   */
  parseValue(
    inputValue: unknown,
    hideSuggestions?: Maybe<boolean>,
  ): Maybe<any> /* T */ {
    return this.coerceInputValue(inputValue, hideSuggestions);
  }

  /**
   * Coerces an external enum name to its internal runtime value.
   * @param inputValue - External enum name to coerce.
   * @param hideSuggestions - Whether suggestion text should be omitted from errors.
   * @returns The internal runtime value for the enum name.
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
   * RGB.coerceInputValue('BLUE'); // => 2
   * RGB.coerceInputValue('PURPLE'); // throws an error
   * RGB.coerceInputValue(2); // throws an error
   * ```
   */
  coerceInputValue(
    inputValue: unknown,
    hideSuggestions?: Maybe<boolean>,
  ): Maybe<any> /* T */ {
    if (typeof inputValue !== 'string') {
      const valueStr = inspect(inputValue);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-string value: ${valueStr}.` +
          (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)),
      );
    }

    const enumValue = this.getValue(inputValue);
    if (enumValue == null) {
      throw new GraphQLError(
        `Value "${inputValue}" does not exist in "${this.name}" enum.` +
          (hideSuggestions ? '' : didYouMeanEnumValue(this, inputValue)),
      );
    }
    return enumValue.value;
  }

  /**
   * Legacy enum parser for externally provided input literals.
   * @param valueNode - Enum value AST node to parse.
   * @param _variables - Deprecated variable values parameter that is no longer used.
   * @param hideSuggestions - Whether suggestion text should be omitted from errors.
   * @returns The internal runtime value for the enum literal.
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
   * @deprecated use `coerceInputLiteral()` instead, `parseLiteral()` will be removed in v18
   */
  parseLiteral(
    valueNode: ValueNode,
    _variables: Maybe<ObjMap<unknown>>,
    hideSuggestions?: Maybe<boolean>,
  ): Maybe<any> /* T */ {
    // Note: variables will be resolved to a value before calling this function.
    return this.coerceInputLiteral(
      valueNode as ConstValueNode,
      hideSuggestions,
    );
  }

  /**
   * Coerces an enum value AST node to its internal runtime value.
   * @param valueNode - Enum value AST node to coerce.
   * @param hideSuggestions - Whether suggestion text should be omitted from errors.
   * @returns The internal runtime value for the enum literal.
   * @example
   * ```ts
   * import { parseConstValue } from 'graphql/language';
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
   * RGB.coerceInputLiteral(parseConstValue('RED')); // => 0
   * RGB.coerceInputLiteral(parseConstValue('"RED"'), true); // throws an error
   * ```
   */
  coerceInputLiteral(
    valueNode: ConstValueNode,
    hideSuggestions?: Maybe<boolean>,
  ): Maybe<any> /* T */ {
    if (valueNode.kind !== Kind.ENUM) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` +
          (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)),
        { nodes: valueNode },
      );
    }

    const enumValue = this.getValue(valueNode.value);
    if (enumValue == null) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Value "${valueStr}" does not exist in "${this.name}" enum.` +
          (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)),
        { nodes: valueNode },
      );
    }
    return enumValue.value;
  }

  /**
   * Converts a runtime enum value to a GraphQL enum value AST node.
   * @param value - Runtime enum value to convert.
   * @returns Enum value AST node, or undefined if the value is invalid.
   * @example
   * ```ts
   * import { print } from 'graphql/language';
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
   * print(RGB.valueToLiteral(2)); // => 'BLUE'
   * RGB.valueToLiteral(3); // => undefined
   * ```
   */
  valueToLiteral(value: unknown): ConstValueNode | undefined {
    if (typeof value === 'string' && this.getValue(value)) {
      return { kind: Kind.ENUM, value };
    }
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
   * RGBCopy.coerceOutputValue(2); // => 'BLUE'
   * ```
   */
  toConfig(): GraphQLEnumTypeNormalizedConfig {
    return {
      name: this.name,
      description: this.description,
      values: keyValMap(
        this.getValues(),
        (value) => value.name,
        (value) => value.toConfig(),
      ),
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

function defineEnumValues(
  parentEnum: GraphQLEnumType,
  values: ThunkObjMap<GraphQLEnumValueConfig /* <T> */>,
): ReadonlyArray<GraphQLEnumValue> {
  const valueMap = resolveObjMapThunk(values);

  return Object.entries(valueMap).map(
    ([valueName, valueConfig]) =>
      new GraphQLEnumValue(parentEnum, valueName, valueConfig),
  );
}

function didYouMeanEnumValue(
  enumType: GraphQLEnumType,
  unknownValueStr: string,
): string {
  const allNames = enumType.getValues().map((value) => value.name);
  const suggestedValues = suggestionList(unknownValueStr, allNames);

  return didYouMean('the enum value', suggestedValues);
}

/** Configuration used to construct a GraphQLEnumType. */
export interface GraphQLEnumTypeConfig {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Values contained in this enum, list, or input-object definition. */
  values: ThunkObjMap<GraphQLEnumValueConfig /* <T> */>;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<Readonly<GraphQLEnumTypeExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<EnumTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<EnumTypeExtensionNode>>;
}

/** @internal */
export interface GraphQLEnumTypeNormalizedConfig extends GraphQLEnumTypeConfig {
  values: GraphQLEnumValueNormalizedConfigMap;
  extensions: Readonly<GraphQLEnumTypeExtensions>;
  extensionASTNodes: ReadonlyArray<EnumTypeExtensionNode>;
}

/** A map of enum value names to enum value configuration objects. */
export type GraphQLEnumValueConfigMap /* <T> */ =
  ObjMap<GraphQLEnumValueConfig /* <T> */>;

/** @internal */
export type GraphQLEnumValueNormalizedConfigMap /* <T> */ =
  ObjMap<GraphQLEnumValueNormalizedConfig /* <T> */>;

/**
 * Custom extensions
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export interface GraphQLEnumValueExtensions {
  [attributeName: string | symbol]: unknown;
}

/** Configuration used to define a GraphQL enum value. */
export interface GraphQLEnumValueConfig {
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Parsed value represented by this node. */
  value?: any /* T */;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason?: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<Readonly<GraphQLEnumValueExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<EnumValueDefinitionNode>;
}

/** @internal */
export interface GraphQLEnumValueNormalizedConfig extends GraphQLEnumValueConfig {
  extensions: Readonly<GraphQLEnumValueExtensions>;
}

/** A resolved GraphQL enum value definition. */
export class GraphQLEnumValue implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLEnumValue instances.
   * @private
   */
  readonly __kind: symbol;
  /** Enum type that owns this enum value. */
  parentEnum: GraphQLEnumType;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Parsed value represented by this node. */
  value: any /* T */;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions: Readonly<GraphQLEnumValueExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<EnumValueDefinitionNode>;

  /**
   * Creates a resolved GraphQL enum value definition.
   * @param parentEnum - Enum type that owns this enum value.
   * @param name - Enum value name.
   * @param config - Enum value configuration.
   * @example
   * ```ts
   * import { GraphQLEnumType, GraphQLEnumValue } from 'graphql/type';
   *
   * const Episode = new GraphQLEnumType({
   *   name: 'Episode',
   *   values: { NEW_HOPE: { value: 4 } },
   * });
   * const enumValue = new GraphQLEnumValue(Episode, 'EMPIRE', {
   *   value: 5,
   *   description: 'Released in 1980.',
   * });
   *
   * enumValue.parentEnum; // => Episode
   * enumValue.name; // => 'EMPIRE'
   * enumValue.value; // => 5
   * ```
   */
  constructor(
    parentEnum: GraphQLEnumType,
    name: string,
    config: GraphQLEnumValueConfig,
  ) {
    this.__kind = enumValueSymbol;
    this.parentEnum = parentEnum;
    this.name = assertEnumValueName(name);
    this.description = config.description;
    this.value = config.value !== undefined ? config.value : name;
    this.deprecationReason = config.deprecationReason;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
    return 'GraphQLEnumValue';
  }

  /**
   * Returns a normalized configuration object for this enum value.
   * @returns A configuration object that can be used to recreate this enum value.
   * @example
   * ```ts
   * import { GraphQLEnumType, GraphQLEnumValue } from 'graphql/type';
   *
   * const Episode = new GraphQLEnumType({
   *   name: 'Episode',
   *   values: { NEW_HOPE: { value: 4 } },
   * });
   * const enumValue = new GraphQLEnumValue(Episode, 'EMPIRE', {
   *   value: 5,
   *   extensions: { trilogy: 'original' },
   * });
   *
   * enumValue.toConfig(); // => { description: undefined, value: 5, deprecationReason: undefined, extensions: { trilogy: 'original' }, astNode: undefined }
   * ```
   */
  toConfig(): GraphQLEnumValueNormalizedConfig {
    return {
      description: this.description,
      value: this.value,
      deprecationReason: this.deprecationReason,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }

  /**
   * Returns this enum value as a schema coordinate string.
   * @returns Enum value coordinate.
   * @example
   * ```ts
   * import { GraphQLEnumType, GraphQLEnumValue } from 'graphql/type';
   *
   * const Episode = new GraphQLEnumType({
   *   name: 'Episode',
   *   values: { NEW_HOPE: { value: 4 } },
   * });
   * const enumValue = new GraphQLEnumValue(Episode, 'EMPIRE', { value: 5 });
   *
   * enumValue.toString(); // => 'Episode.EMPIRE'
   * ```
   */
  toString(): string {
    return `${this.parentEnum.name}.${this.name}`;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns Enum value coordinate.
   * @example
   * ```ts
   * import { GraphQLEnumType, GraphQLEnumValue } from 'graphql/type';
   *
   * const Episode = new GraphQLEnumType({
   *   name: 'Episode',
   *   values: { NEW_HOPE: { value: 4 } },
   * });
   * const enumValue = new GraphQLEnumValue(Episode, 'EMPIRE', { value: 5 });
   *
   * JSON.stringify(enumValue); // => '"Episode.EMPIRE"'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
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
  [attributeName: string | symbol]: unknown;
}

/**
 * Input Object Type Definition
 *
 * An input object defines a structured collection of fields which may be
 * supplied to a field argument.
 *
 * Using `NonNull` will ensure that a value must be provided by the query
 *
 * Example:
 *
 * ```ts
 * const GeoPoint = new GraphQLInputObjectType({
 *   name: 'GeoPoint',
 *   fields: {
 *     lat: { type: new GraphQLNonNull(GraphQLFloat) },
 *     lon: { type: new GraphQLNonNull(GraphQLFloat) },
 *     alt: { type: GraphQLFloat, default: { value: 0 } },
 *   }
 * });
 * ```
 */
export class GraphQLInputObjectType implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLInputObjectType instances.
   * @private
   */
  readonly __kind: symbol;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** Extension fields to include in the formatted result. */
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
   *       default: { value: '' },
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
   * fields.commentary.default.value; // => ''
   * fields.commentary.deprecationReason; // => 'Use body.'
   * ReviewInput.isOneOf; // => false
   * SearchBy.isOneOf; // => true
   * ```
   */
  constructor(config: Readonly<GraphQLInputObjectTypeConfig>) {
    this.__kind = inputObjectSymbol;
    this.name = assertName(config.name);
    this.description = config.description;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes ?? [];
    this.isOneOf = config.isOneOf ?? false;

    this._fields = defineInputFieldMap.bind(undefined, this, config.fields);
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
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
   * fields.commentary.default; // => { literal: { kind: 'StringValue', value: '' } }
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
    return {
      name: this.name,
      description: this.description,
      fields: mapValue(this.getFields(), (field) => field.toConfig()),
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
  parentType: GraphQLInputObjectType,
  fields: ThunkObjMap<GraphQLInputFieldConfig>,
): GraphQLInputFieldMap {
  const fieldMap = resolveObjMapThunk(fields);
  return mapValue(
    fieldMap,
    (fieldConfig, fieldName) =>
      new GraphQLInputField(parentType, fieldName, fieldConfig),
  );
}

/** Configuration used to construct a GraphQLInputObjectType. */
export interface GraphQLInputObjectTypeConfig {
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** Fields declared by this object, interface, input object, or literal. */
  fields: ThunkObjMap<GraphQLInputFieldConfig>;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<Readonly<GraphQLInputObjectTypeExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<InputObjectTypeDefinitionNode>;
  /** AST extension nodes applied to this schema element. */
  extensionASTNodes?: Maybe<ReadonlyArray<InputObjectTypeExtensionNode>>;
  /** Whether this input object uses the experimental OneOf input object semantics. */
  isOneOf?: boolean;
}

/** @internal */
export interface GraphQLInputObjectTypeNormalizedConfig extends GraphQLInputObjectTypeConfig {
  fields: GraphQLInputFieldNormalizedConfigMap;
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
  [attributeName: string | symbol]: unknown;
}

/** Configuration used to define a GraphQL input field. */
export interface GraphQLInputFieldConfig {
  /** Human-readable description for this schema element, if provided. */
  description?: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLInputType;
  /**
   * Legacy default value for this input field.
   * @deprecated use `default` instead, `defaultValue` will be removed in v18
   */
  defaultValue?: unknown;
  /** Default value represented as either a runtime value or a GraphQL literal. */
  default?: GraphQLDefaultInput | undefined;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason?: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions?: Maybe<Readonly<GraphQLInputFieldExtensions>>;
  /** AST node from which this schema element was built, if available. */
  astNode?: Maybe<InputValueDefinitionNode>;
}

/** A map of input field names to input field configuration objects. */
export type GraphQLInputFieldConfigMap = ObjMap<GraphQLInputFieldConfig>;

/** @internal */
export interface GraphQLInputFieldNormalizedConfig extends GraphQLInputFieldConfig {
  default: GraphQLDefaultInput | undefined;
  extensions: Readonly<GraphQLInputFieldExtensions>;
}

/** @internal */
export type GraphQLInputFieldNormalizedConfigMap =
  ObjMap<GraphQLInputFieldNormalizedConfig>;

/** A resolved GraphQL input field definition. */
export class GraphQLInputField implements GraphQLSchemaElement {
  /**
   * Internal runtime marker used to identify GraphQLInputField instances.
   * @private
   */
  readonly __kind: symbol;
  /** Input object type that owns this input field. */
  parentType: GraphQLInputObjectType;
  /** The GraphQL name for this schema element. */
  name: string;
  /** Human-readable description for this schema element, if provided. */
  description: Maybe<string>;
  /** The GraphQL type reference or runtime type for this element. */
  type: GraphQLInputType;
  /**
   * Legacy default value used when no explicit value is supplied.
   * @deprecated use `default` instead, `defaultValue` will be removed in v18
   */
  defaultValue: unknown;
  /** Default value represented as either a runtime value or a GraphQL literal. */
  default: GraphQLDefaultInput | undefined;
  /**
   * Cached coerced default value.
   * @private
   */
  _memoizedCoercedDefaultValue: unknown;
  /** Reason this element is deprecated, if one was provided. */
  deprecationReason: Maybe<string>;
  /** Extension fields to include in the formatted result. */
  extensions: Readonly<GraphQLInputFieldExtensions>;
  /** AST node from which this schema element was built, if available. */
  astNode: Maybe<InputValueDefinitionNode>;

  /**
   * Creates a resolved GraphQL input field definition.
   * @param parentType - Input object type that owns this field.
   * @param name - Input field name.
   * @param config - Input field configuration.
   * @example
   * ```ts
   * import { GraphQLInputField, GraphQLInputObjectType, GraphQLString } from 'graphql/type';
   *
   * const ReviewInput = new GraphQLInputObjectType({
   *   name: 'ReviewInput',
   *   fields: {},
   * });
   * const field = new GraphQLInputField(ReviewInput, 'commentary', {
   *   type: GraphQLString,
   *   default: { value: '' },
   * });
   *
   * field.parentType; // => ReviewInput
   * field.name; // => 'commentary'
   * field.default.value; // => ''
   * ```
   */
  constructor(
    parentType: GraphQLInputObjectType,
    name: string,
    config: GraphQLInputFieldConfig,
  ) {
    devAssert(
      !('resolve' in config),
      `${parentType}.${name} field has a resolve property, but Input Types cannot define resolvers.`,
    );

    this.__kind = inputFieldSymbol;
    this.parentType = parentType;
    this.name = assertName(name);
    this.description = config.description;
    this.type = config.type;
    this.defaultValue = config.defaultValue;
    this.default = config.default;
    this._memoizedCoercedDefaultValue = undefined;
    this.deprecationReason = config.deprecationReason;
    this.extensions = toObjMapWithSymbols(config.extensions);
    this.astNode = config.astNode;
  }

  /**
   * Returns the value used by `Object.prototype.toString`.
   * @returns The built-in string tag for this object.
   */
  get [Symbol.toStringTag](): string {
    return 'GraphQLInputField';
  }

  /**
   * Returns a normalized configuration object for this input field.
   * @returns A configuration object that can be used to recreate this input field.
   * @example
   * ```ts
   * import { GraphQLInputField, GraphQLInputObjectType, GraphQLString } from 'graphql/type';
   *
   * const ReviewInput = new GraphQLInputObjectType({
   *   name: 'ReviewInput',
   *   fields: {},
   * });
   * const field = new GraphQLInputField(ReviewInput, 'commentary', {
   *   type: GraphQLString,
   *   extensions: { form: 'review' },
   * });
   *
   * field.toConfig().extensions; // => { form: 'review' }
   * ```
   */
  toConfig(): GraphQLInputFieldNormalizedConfig {
    return {
      description: this.description,
      type: this.type,
      defaultValue: this.defaultValue,
      default: this.default,
      deprecationReason: this.deprecationReason,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }

  /**
   * Returns this input field as a schema coordinate string.
   * @returns The input field coordinate.
   * @example
   * ```ts
   * import { GraphQLInputField, GraphQLInputObjectType, GraphQLString } from 'graphql/type';
   *
   * const ReviewInput = new GraphQLInputObjectType({
   *   name: 'ReviewInput',
   *   fields: {},
   * });
   * const field = new GraphQLInputField(ReviewInput, 'commentary', {
   *   type: GraphQLString,
   * });
   *
   * field.toString(); // => 'ReviewInput.commentary'
   * ```
   */
  toString(): string {
    return `${this.parentType}.${this.name}`;
  }

  /**
   * Returns the JSON representation used when this object is serialized.
   * @returns The input field coordinate.
   * @example
   * ```ts
   * import { GraphQLInputField, GraphQLInputObjectType, GraphQLString } from 'graphql/type';
   *
   * const ReviewInput = new GraphQLInputObjectType({
   *   name: 'ReviewInput',
   *   fields: {},
   * });
   * const field = new GraphQLInputField(ReviewInput, 'commentary', {
   *   type: GraphQLString,
   * });
   *
   * JSON.stringify(field); // => '"ReviewInput.commentary"'
   * ```
   */
  toJSON(): string {
    return this.toString();
  }
}

/**
 * Returns true when the input field is non-null and has no default value.
 * @param field - The input field definition to inspect.
 * @returns True when the input field is non-null and has no default value.
 * @example
 * ```ts
 * import {
 *   GraphQLInputField,
 *   GraphQLInputObjectType,
 *   GraphQLInt,
 *   GraphQLNonNull,
 *   GraphQLString,
 *   isRequiredInputField,
 * } from 'graphql/type';
 *
 * const ReviewInput = new GraphQLInputObjectType({
 *   name: 'ReviewInput',
 *   fields: {},
 * });
 * const requiredField = new GraphQLInputField(ReviewInput, 'id', {
 *   type: new GraphQLNonNull(GraphQLInt),
 * });
 * const optionalField = new GraphQLInputField(ReviewInput, 'name', {
 *   type: GraphQLString,
 * });
 * const fieldWithDefault = new GraphQLInputField(ReviewInput, 'limit', {
 *   type: new GraphQLNonNull(GraphQLInt),
 *   default: { value: 10 },
 * });
 *
 * isRequiredInputField(requiredField); // => true
 * isRequiredInputField(optionalField); // => false
 * isRequiredInputField(fieldWithDefault); // => false
 * ```
 */
export function isRequiredInputField(field: GraphQLInputField): boolean {
  return (
    isNonNullType(field.type) &&
    field.defaultValue === undefined &&
    field.default === undefined
  );
}

/** A map of input field names to resolved input field definitions. */
export type GraphQLInputFieldMap = ObjMap<GraphQLInputField>;
