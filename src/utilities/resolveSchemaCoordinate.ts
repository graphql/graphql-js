/** @category Schema Coordinates */

import { inspect } from '../jsutils/inspect.ts';

import type {
  ArgumentCoordinateNode,
  DirectiveArgumentCoordinateNode,
  DirectiveCoordinateNode,
  MemberCoordinateNode,
  SchemaCoordinateNode,
  TypeCoordinateNode,
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import { parseSchemaCoordinate } from '../language/parser.ts';
import type { Source } from '../language/source.ts';

import type {
  GraphQLArgument,
  GraphQLEnumType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
} from '../type/definition.ts';
import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
} from '../type/definition.ts';
import type { GraphQLDirective } from '../type/directives.ts';
import type { GraphQLSchema } from '../type/schema.ts';

/**
 * A resolved schema element may be one of the following kinds:
 *
 * @internal
 */
export interface ResolvedNamedType {
  readonly kind: 'NamedType';
  readonly type: GraphQLNamedType;
}

/** @internal */
export interface ResolvedField {
  readonly kind: 'Field';
  readonly type: GraphQLObjectType | GraphQLInterfaceType;
  readonly field: GraphQLField<unknown, unknown>;
}

/** @internal */
export interface ResolvedInputField {
  readonly kind: 'InputField';
  readonly type: GraphQLInputObjectType;
  readonly inputField: GraphQLInputField;
}

/** @internal */
export interface ResolvedEnumValue {
  readonly kind: 'EnumValue';
  readonly type: GraphQLEnumType;
  readonly enumValue: GraphQLEnumValue;
}

/** @internal */
export interface ResolvedFieldArgument {
  readonly kind: 'FieldArgument';
  readonly type: GraphQLObjectType | GraphQLInterfaceType;
  readonly field: GraphQLField<unknown, unknown>;
  readonly fieldArgument: GraphQLArgument;
}

/** @internal */
export interface ResolvedDirective {
  readonly kind: 'Directive';
  readonly directive: GraphQLDirective;
}

/** @internal */
export interface ResolvedDirectiveArgument {
  readonly kind: 'DirectiveArgument';
  readonly directive: GraphQLDirective;
  readonly directiveArgument: GraphQLArgument;
}

/** A schema element resolved from a schema coordinate. */
export type ResolvedSchemaElement =
  | ResolvedNamedType
  | ResolvedField
  | ResolvedInputField
  | ResolvedEnumValue
  | ResolvedFieldArgument
  | ResolvedDirective
  | ResolvedDirectiveArgument;

/**
 * A schema coordinate is resolved in the context of a GraphQL schema to
 * uniquely identify a schema element. It returns undefined if the schema
 * coordinate does not resolve to a schema element, meta-field, or introspection
 * schema element. It will throw if the containing schema element (if
 * applicable) does not exist.
 *
 * https://spec.graphql.org/draft/#sec-Schema-Coordinates.Semantics
 * @param schema - GraphQL schema to use.
 * @param schemaCoordinate - The schema coordinate to resolve.
 * @returns The schema element identified by the coordinate, or undefined if none exists.
 * @example
 * ```ts
 * import { buildSchema, resolveSchemaCoordinate } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   directive @tag(name: String!) on FIELD_DEFINITION
 *
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   enum Episode {
 *     NEW_HOPE
 *   }
 *
 *   type Query {
 *     reviews(input: ReviewInput): [String] @tag(name: "reviews")
 *   }
 * `);
 *
 * resolveSchemaCoordinate(schema, 'Query').kind; // => 'NamedType'
 * resolveSchemaCoordinate(schema, 'Query.reviews').kind; // => 'Field'
 * resolveSchemaCoordinate(schema, 'Query.reviews(input:)').kind; // => 'FieldArgument'
 * resolveSchemaCoordinate(schema, 'ReviewInput.stars').kind; // => 'InputField'
 * resolveSchemaCoordinate(schema, 'Episode.NEW_HOPE').kind; // => 'EnumValue'
 * resolveSchemaCoordinate(schema, '@tag').kind; // => 'Directive'
 * resolveSchemaCoordinate(schema, '@tag(name:)').kind; // => 'DirectiveArgument'
 * resolveSchemaCoordinate(schema, 'Query.missing'); // => undefined
 * ```
 */
export function resolveSchemaCoordinate(
  schema: GraphQLSchema,
  schemaCoordinate: string | Source,
): ResolvedSchemaElement | undefined {
  return resolveASTSchemaCoordinate(
    schema,
    parseSchemaCoordinate(schemaCoordinate),
  );
}

/**
 * TypeCoordinate : Name
 *
 * @internal
 */
function resolveTypeCoordinate(
  schema: GraphQLSchema,
  schemaCoordinate: TypeCoordinateNode,
): ResolvedNamedType | undefined {
  // 1. Let {typeName} be the value of {Name}.
  const typeName = schemaCoordinate.name.value;
  const type = schema.getType(typeName);

  // 2. Return the type in the {schema} named {typeName} if it exists.
  if (type == null) {
    return;
  }

  return { kind: 'NamedType', type };
}

/**
 * MemberCoordinate : Name . Name
 *
 * @internal
 */
function resolveMemberCoordinate(
  schema: GraphQLSchema,
  schemaCoordinate: MemberCoordinateNode,
): ResolvedField | ResolvedInputField | ResolvedEnumValue | undefined {
  // 1. Let {typeName} be the value of the first {Name}.
  // 2. Let {type} be the type in the {schema} named {typeName}.
  const typeName = schemaCoordinate.name.value;
  const type = schema.getType(typeName);

  // 3. Assert: {type} must exist, and must be an Enum, Input Object, Object or Interface type.
  if (!type) {
    throw new Error(
      `Expected ${inspect(typeName)} to be defined as a type in the schema.`,
    );
  }
  if (
    !isEnumType(type) &&
    !isInputObjectType(type) &&
    !isObjectType(type) &&
    !isInterfaceType(type)
  ) {
    throw new Error(
      `Expected ${inspect(typeName)} to be an Enum, Input Object, Object or Interface type.`,
    );
  }

  // 4. If {type} is an Enum type:
  if (isEnumType(type)) {
    // 1. Let {enumValueName} be the value of the second {Name}.
    const enumValueName = schemaCoordinate.memberName.value;
    const enumValue = type.getValue(enumValueName);

    // 2. Return the enum value of {type} named {enumValueName} if it exists.
    if (enumValue == null) {
      return;
    }

    return { kind: 'EnumValue', type, enumValue };
  }

  // 5. Otherwise, if {type} is an Input Object type:
  if (isInputObjectType(type)) {
    // 1. Let {inputFieldName} be the value of the second {Name}.
    const inputFieldName = schemaCoordinate.memberName.value;
    const inputField = type.getFields()[inputFieldName];

    // 2. Return the input field of {type} named {inputFieldName} if it exists.
    if (inputField == null) {
      return;
    }

    return { kind: 'InputField', type, inputField };
  }

  // 6. Otherwise:
  // 1. Let {fieldName} be the value of the second {Name}.
  const fieldName = schemaCoordinate.memberName.value;
  const field = schema.getField(type, fieldName);

  // 2. Return the field of {type} named {fieldName} if it exists.
  if (field == null) {
    return;
  }

  return { kind: 'Field', type, field };
}

/**
 * ArgumentCoordinate : Name . Name ( Name : )
 *
 * @internal
 */
function resolveArgumentCoordinate(
  schema: GraphQLSchema,
  schemaCoordinate: ArgumentCoordinateNode,
): ResolvedFieldArgument | undefined {
  // 1. Let {typeName} be the value of the first {Name}.
  // 2. Let {type} be the type in the {schema} named {typeName}.
  const typeName = schemaCoordinate.name.value;
  const type = schema.getType(typeName);

  // 3. Assert: {type} must exist, and be an Object or Interface type.
  if (type == null) {
    throw new Error(
      `Expected ${inspect(typeName)} to be defined as a type in the schema.`,
    );
  }
  if (!isObjectType(type) && !isInterfaceType(type)) {
    throw new Error(
      `Expected ${inspect(typeName)} to be an object type or interface type.`,
    );
  }

  // 4. Let {fieldName} be the value of the second {Name}.
  // 5. Let {field} be the field of {type} named {fieldName}.
  const fieldName = schemaCoordinate.fieldName.value;
  const field = schema.getField(type, fieldName);

  // 7. Assert: {field} must exist.
  if (field == null) {
    throw new Error(
      `Expected ${inspect(fieldName)} to exist as a field of type ${inspect(typeName)} in the schema.`,
    );
  }

  // 7. Let {fieldArgumentName} be the value of the third {Name}.
  const fieldArgumentName = schemaCoordinate.argumentName.value;
  const fieldArgument = field.args.find(
    (arg) => arg.name === fieldArgumentName,
  );

  // 8. Return the argument of {field} named {fieldArgumentName} if it exists.
  if (fieldArgument == null) {
    return;
  }

  return { kind: 'FieldArgument', type, field, fieldArgument };
}

/**
 * DirectiveCoordinate : @ Name
 *
 * @internal
 */
function resolveDirectiveCoordinate(
  schema: GraphQLSchema,
  schemaCoordinate: DirectiveCoordinateNode,
): ResolvedDirective | undefined {
  // 1. Let {directiveName} be the value of {Name}.
  const directiveName = schemaCoordinate.name.value;
  const directive = schema.getDirective(directiveName);

  // 2. Return the directive in the {schema} named {directiveName} if it exists.
  if (!directive) {
    return;
  }

  return { kind: 'Directive', directive };
}

/**
 * DirectiveArgumentCoordinate : @ Name ( Name : )
 *
 * @internal
 */
function resolveDirectiveArgumentCoordinate(
  schema: GraphQLSchema,
  schemaCoordinate: DirectiveArgumentCoordinateNode,
): ResolvedDirectiveArgument | undefined {
  // 1. Let {directiveName} be the value of the first {Name}.
  // 2. Let {directive} be the directive in the {schema} named {directiveName}.
  const directiveName = schemaCoordinate.name.value;
  const directive = schema.getDirective(directiveName);

  // 3. Assert {directive} must exist.
  if (!directive) {
    throw new Error(
      `Expected ${inspect(directiveName)} to be defined as a directive in the schema.`,
    );
  }

  // 4. Let {directiveArgumentName} be the value of the second {Name}.
  const {
    argumentName: { value: directiveArgumentName },
  } = schemaCoordinate;
  const directiveArgument = directive.args.find(
    (arg) => arg.name === directiveArgumentName,
  );

  // 5. Return the argument of {directive} named {directiveArgumentName} if it exists.
  if (!directiveArgument) {
    return;
  }

  return { kind: 'DirectiveArgument', directive, directiveArgument };
}

/**
 * Resolves schema coordinate from a parsed SchemaCoordinate node.
 * @param schema - GraphQL schema to use.
 * @param schemaCoordinate - The schema coordinate to resolve.
 * @returns The schema element identified by the parsed coordinate, or undefined if none exists.
 * @example
 * ```ts
 * import { parseSchemaCoordinate } from 'graphql/language';
 * import { buildSchema, resolveASTSchemaCoordinate } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting(name: String): String
 *   }
 * `);
 * const coordinate = parseSchemaCoordinate('Query.greeting(name:)');
 * const resolved = resolveASTSchemaCoordinate(schema, coordinate);
 *
 * resolved.kind; // => 'FieldArgument'
 * resolved.field.name; // => 'greeting'
 * resolved.fieldArgument.name; // => 'name'
 * ```
 */
export function resolveASTSchemaCoordinate(
  schema: GraphQLSchema,
  schemaCoordinate: SchemaCoordinateNode,
): ResolvedSchemaElement | undefined {
  switch (schemaCoordinate.kind) {
    case Kind.TYPE_COORDINATE:
      return resolveTypeCoordinate(schema, schemaCoordinate);
    case Kind.MEMBER_COORDINATE:
      return resolveMemberCoordinate(schema, schemaCoordinate);
    case Kind.ARGUMENT_COORDINATE:
      return resolveArgumentCoordinate(schema, schemaCoordinate);
    case Kind.DIRECTIVE_COORDINATE:
      return resolveDirectiveCoordinate(schema, schemaCoordinate);
    case Kind.DIRECTIVE_ARGUMENT_COORDINATE:
      return resolveDirectiveArgumentCoordinate(schema, schemaCoordinate);
  }
}
