import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';

import { DirectiveLocation } from '../language/directiveLocation';
import { print } from '../language/printer';

import { astFromValue } from '../utilities/astFromValue';

import type {
  GraphQLEnumValue,
  GraphQLField,
  GraphQLFieldConfigMap,
  GraphQLInputField,
  GraphQLNamedType,
  GraphQLType,
} from './definition';
import {
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSemanticNullable,
  isAbstractType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isSemanticNullableType,
  isUnionType,
} from './definition';
import type { GraphQLDirective } from './directives';
import { GraphQLBoolean, GraphQLString } from './scalars';
import type { GraphQLSchema } from './schema';

export const __Schema: GraphQLObjectType = new GraphQLObjectType({
  name: '__Schema',
  description:
    'A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.',
  fields: () =>
    ({
      description: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (schema) => schema.description,
      },
      types: {
        description: 'A list of all types supported by this server.',
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(__Type))),
        resolve(schema) {
          return Object.values(schema.getTypeMap());
        },
      },
      queryType: {
        description: 'The type that query operations will be rooted at.',
        type: new GraphQLNonNull(__Type),
        resolve: (schema) => schema.getQueryType(),
      },
      mutationType: {
        description:
          'If this server supports mutation, the type that mutation operations will be rooted at.',
        type: new GraphQLSemanticNullable(__Type),
        resolve: (schema) => schema.getMutationType(),
      },
      subscriptionType: {
        description:
          'If this server support subscription, the type that subscription operations will be rooted at.',
        type: new GraphQLSemanticNullable(__Type),
        resolve: (schema) => schema.getSubscriptionType(),
      },
      directives: {
        description: 'A list of all directives supported by this server.',
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(__Directive)),
        ),
        resolve: (schema) => schema.getDirectives(),
      },
    } as GraphQLFieldConfigMap<GraphQLSchema, unknown>),
});

export const __Directive: GraphQLObjectType = new GraphQLObjectType({
  name: '__Directive',
  description:
    "A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.\n\nIn some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.",
  fields: () =>
    ({
      name: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (directive) => directive.name,
      },
      description: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (directive) => directive.description,
      },
      isRepeatable: {
        type: new GraphQLNonNull(GraphQLBoolean),
        resolve: (directive) => directive.isRepeatable,
      },
      locations: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(__DirectiveLocation)),
        ),
        resolve: (directive) => directive.locations,
      },
      args: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(__InputValue)),
        ),
        args: {
          includeDeprecated: {
            type: GraphQLBoolean,
            defaultValue: false,
          },
        },
        resolve(field, { includeDeprecated }) {
          return includeDeprecated
            ? field.args
            : field.args.filter((arg) => arg.deprecationReason == null);
        },
      },
    } as GraphQLFieldConfigMap<GraphQLDirective, unknown>),
});

export const __DirectiveLocation: GraphQLEnumType = new GraphQLEnumType({
  name: '__DirectiveLocation',
  description:
    'A Directive can be adjacent to many parts of the GraphQL language, a __DirectiveLocation describes one such possible adjacencies.',
  values: {
    QUERY: {
      value: DirectiveLocation.QUERY,
      description: 'Location adjacent to a query operation.',
    },
    MUTATION: {
      value: DirectiveLocation.MUTATION,
      description: 'Location adjacent to a mutation operation.',
    },
    SUBSCRIPTION: {
      value: DirectiveLocation.SUBSCRIPTION,
      description: 'Location adjacent to a subscription operation.',
    },
    FIELD: {
      value: DirectiveLocation.FIELD,
      description: 'Location adjacent to a field.',
    },
    FRAGMENT_DEFINITION: {
      value: DirectiveLocation.FRAGMENT_DEFINITION,
      description: 'Location adjacent to a fragment definition.',
    },
    FRAGMENT_SPREAD: {
      value: DirectiveLocation.FRAGMENT_SPREAD,
      description: 'Location adjacent to a fragment spread.',
    },
    INLINE_FRAGMENT: {
      value: DirectiveLocation.INLINE_FRAGMENT,
      description: 'Location adjacent to an inline fragment.',
    },
    VARIABLE_DEFINITION: {
      value: DirectiveLocation.VARIABLE_DEFINITION,
      description: 'Location adjacent to a variable definition.',
    },
    SCHEMA: {
      value: DirectiveLocation.SCHEMA,
      description: 'Location adjacent to a schema definition.',
    },
    SCALAR: {
      value: DirectiveLocation.SCALAR,
      description: 'Location adjacent to a scalar definition.',
    },
    OBJECT: {
      value: DirectiveLocation.OBJECT,
      description: 'Location adjacent to an object type definition.',
    },
    FIELD_DEFINITION: {
      value: DirectiveLocation.FIELD_DEFINITION,
      description: 'Location adjacent to a field definition.',
    },
    ARGUMENT_DEFINITION: {
      value: DirectiveLocation.ARGUMENT_DEFINITION,
      description: 'Location adjacent to an argument definition.',
    },
    INTERFACE: {
      value: DirectiveLocation.INTERFACE,
      description: 'Location adjacent to an interface definition.',
    },
    UNION: {
      value: DirectiveLocation.UNION,
      description: 'Location adjacent to a union definition.',
    },
    ENUM: {
      value: DirectiveLocation.ENUM,
      description: 'Location adjacent to an enum definition.',
    },
    ENUM_VALUE: {
      value: DirectiveLocation.ENUM_VALUE,
      description: 'Location adjacent to an enum value definition.',
    },
    INPUT_OBJECT: {
      value: DirectiveLocation.INPUT_OBJECT,
      description: 'Location adjacent to an input object type definition.',
    },
    INPUT_FIELD_DEFINITION: {
      value: DirectiveLocation.INPUT_FIELD_DEFINITION,
      description: 'Location adjacent to an input object field definition.',
    },
  },
});

// TODO: rename enum and options
enum TypeNullability {
  AUTO = 'AUTO',
  TRADITIONAL = 'TRADITIONAL',
  SEMANTIC = 'SEMANTIC',
  FULL = 'FULL',
}

// TODO: rename
export const __TypeNullability: GraphQLEnumType = new GraphQLEnumType({
  name: '__TypeNullability',
  description: 'TODO',
  values: {
    AUTO: {
      value: TypeNullability.AUTO,
      description:
        'Determines nullability mode based on errorPropagation mode.',
    },
    TRADITIONAL: {
      value: TypeNullability.TRADITIONAL,
      description: 'Turn semantic-non-null types into nullable types.',
    },
    SEMANTIC: {
      value: TypeNullability.SEMANTIC,
      description: 'Turn non-null types into semantic-non-null types.',
    },
    FULL: {
      value: TypeNullability.FULL,
      description:
        'Render the true nullability in the schema; be prepared for new types of nullability in future!',
    },
  },
});

export const __Type: GraphQLObjectType = new GraphQLObjectType({
  name: '__Type',
  description:
    'The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.\n\nDepending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional `specifiedByURL`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.',
  fields: () =>
    ({
      kind: {
        type: new GraphQLNonNull(__TypeKind),
        resolve(type) {
          if (isScalarType(type)) {
            return TypeKind.SCALAR;
          }
          if (isObjectType(type)) {
            return TypeKind.OBJECT;
          }
          if (isInterfaceType(type)) {
            return TypeKind.INTERFACE;
          }
          if (isUnionType(type)) {
            return TypeKind.UNION;
          }
          if (isEnumType(type)) {
            return TypeKind.ENUM;
          }
          if (isInputObjectType(type)) {
            return TypeKind.INPUT_OBJECT;
          }
          if (isListType(type)) {
            return TypeKind.LIST;
          }
          if (isNonNullType(type)) {
            return TypeKind.NON_NULL;
          }
          if (isSemanticNullableType(type)) {
            return TypeKind.SEMANTIC_NULLABLE;
          }
          /* c8 ignore next 3 */
          // Not reachable, all possible types have been considered)
          invariant(false, `Unexpected type: "${inspect(type)}".`);
        },
      },
      name: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (type) => ('name' in type ? type.name : undefined),
      },
      description: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (type) =>
          // FIXME: add test case
          /* c8 ignore next */
          'description' in type ? type.description : undefined,
      },
      specifiedByURL: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (obj) =>
          'specifiedByURL' in obj ? obj.specifiedByURL : undefined,
      },
      fields: {
        type: new GraphQLSemanticNullable(
          new GraphQLList(new GraphQLNonNull(__Field)),
        ),
        args: {
          includeDeprecated: { type: GraphQLBoolean, defaultValue: false },
        },
        resolve(type, { includeDeprecated }) {
          if (isObjectType(type) || isInterfaceType(type)) {
            const fields = Object.values(type.getFields());
            return includeDeprecated
              ? fields
              : fields.filter((field) => field.deprecationReason == null);
          }
        },
      },
      interfaces: {
        type: new GraphQLSemanticNullable(
          new GraphQLList(new GraphQLNonNull(__Type)),
        ),
        resolve(type) {
          if (isObjectType(type) || isInterfaceType(type)) {
            return type.getInterfaces();
          }
        },
      },
      possibleTypes: {
        type: new GraphQLSemanticNullable(
          new GraphQLList(new GraphQLNonNull(__Type)),
        ),
        resolve(type, _args, _context, { schema }) {
          if (isAbstractType(type)) {
            return schema.getPossibleTypes(type);
          }
        },
      },
      enumValues: {
        type: new GraphQLSemanticNullable(
          new GraphQLList(new GraphQLNonNull(__EnumValue)),
        ),
        args: {
          includeDeprecated: { type: GraphQLBoolean, defaultValue: false },
        },
        resolve(type, { includeDeprecated }) {
          if (isEnumType(type)) {
            const values = type.getValues();
            return includeDeprecated
              ? values
              : values.filter((field) => field.deprecationReason == null);
          }
        },
      },
      inputFields: {
        type: new GraphQLSemanticNullable(
          new GraphQLList(new GraphQLNonNull(__InputValue)),
        ),
        args: {
          includeDeprecated: {
            type: GraphQLBoolean,
            defaultValue: false,
          },
        },
        resolve(type, { includeDeprecated }) {
          if (isInputObjectType(type)) {
            const values = Object.values(type.getFields());
            return includeDeprecated
              ? values
              : values.filter((field) => field.deprecationReason == null);
          }
        },
      },
      ofType: {
        type: new GraphQLSemanticNullable(__Type),
        resolve: (type) => ('ofType' in type ? type.ofType : undefined),
      },
      isOneOf: {
        type: new GraphQLSemanticNullable(GraphQLBoolean),
        resolve: (type) => {
          if (isInputObjectType(type)) {
            return type.isOneOf;
          }
        },
      },
    } as GraphQLFieldConfigMap<GraphQLType, unknown>),
});

export const __Field: GraphQLObjectType = new GraphQLObjectType({
  name: '__Field',
  description:
    'Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type.',
  fields: () =>
    ({
      name: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (field) => field.name,
      },
      description: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (field) => field.description,
      },
      args: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(__InputValue)),
        ),
        args: {
          includeDeprecated: {
            type: GraphQLBoolean,
            defaultValue: false,
          },
        },
        resolve(field, { includeDeprecated }) {
          return includeDeprecated
            ? field.args
            : field.args.filter((arg) => arg.deprecationReason == null);
        },
      },
      type: {
        type: new GraphQLNonNull(__Type),
        args: {
          nullability: {
            type: new GraphQLNonNull(__TypeNullability),
            defaultValue: TypeNullability.AUTO,
          },
        },
        resolve: (field, { nullability }, _context, info) => {
          if (nullability === TypeNullability.FULL) {
            return field.type;
          }
          const mode =
            nullability === TypeNullability.AUTO
              ? info.errorPropagation
                ? TypeNullability.TRADITIONAL
                : TypeNullability.SEMANTIC
              : nullability;
          return convertOutputTypeToNullabilityMode(field.type, mode);
        },
      },
      isDeprecated: {
        type: new GraphQLNonNull(GraphQLBoolean),
        resolve: (field) => field.deprecationReason != null,
      },
      deprecationReason: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (field) => field.deprecationReason,
      },
    } as GraphQLFieldConfigMap<GraphQLField<unknown, unknown>, unknown>),
});

// TODO: move this elsewhere, rename, memoize
function convertOutputTypeToNullabilityMode(
  type: GraphQLType,
  mode: TypeNullability.TRADITIONAL | TypeNullability.SEMANTIC,
): GraphQLType {
  if (mode === TypeNullability.TRADITIONAL) {
    if (isNonNullType(type)) {
      return new GraphQLNonNull(
        convertOutputTypeToNullabilityMode(type.ofType, mode),
      );
    } else if (isSemanticNullableType(type)) {
      return convertOutputTypeToNullabilityMode(type.ofType, mode);
    } else if (isListType(type)) {
      return new GraphQLList(
        convertOutputTypeToNullabilityMode(type.ofType, mode),
      );
    }
    return type;
  }
  if (isNonNullType(type) || !isSemanticNullableType(type)) {
    return convertOutputTypeToNullabilityMode(type, mode);
  } else if (isListType(type)) {
    return new GraphQLList(
      convertOutputTypeToNullabilityMode(type.ofType, mode),
    );
  }
  return type;
}

export const __InputValue: GraphQLObjectType = new GraphQLObjectType({
  name: '__InputValue',
  description:
    'Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value.',
  fields: () =>
    ({
      name: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (inputValue) => inputValue.name,
      },
      description: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (inputValue) => inputValue.description,
      },
      type: {
        type: new GraphQLNonNull(__Type),
        resolve: (inputValue) => inputValue.type,
      },
      defaultValue: {
        type: new GraphQLSemanticNullable(GraphQLString),
        description:
          'A GraphQL-formatted string representing the default value for this input value.',
        resolve(inputValue) {
          const { type, defaultValue } = inputValue;
          const valueAST = astFromValue(defaultValue, type);
          return valueAST ? print(valueAST) : null;
        },
      },
      isDeprecated: {
        type: new GraphQLNonNull(GraphQLBoolean),
        resolve: (field) => field.deprecationReason != null,
      },
      deprecationReason: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (obj) => obj.deprecationReason,
      },
    } as GraphQLFieldConfigMap<GraphQLInputField, unknown>),
});

export const __EnumValue: GraphQLObjectType = new GraphQLObjectType({
  name: '__EnumValue',
  description:
    'One possible value for a given Enum. Enum values are unique values, not a placeholder for a string or numeric value. However an Enum value is returned in a JSON response as a string.',
  fields: () =>
    ({
      name: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (enumValue) => enumValue.name,
      },
      description: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (enumValue) => enumValue.description,
      },
      isDeprecated: {
        type: new GraphQLNonNull(GraphQLBoolean),
        resolve: (enumValue) => enumValue.deprecationReason != null,
      },
      deprecationReason: {
        type: new GraphQLSemanticNullable(GraphQLString),
        resolve: (enumValue) => enumValue.deprecationReason,
      },
    } as GraphQLFieldConfigMap<GraphQLEnumValue, unknown>),
});

enum TypeKind {
  SCALAR = 'SCALAR',
  OBJECT = 'OBJECT',
  INTERFACE = 'INTERFACE',
  UNION = 'UNION',
  ENUM = 'ENUM',
  INPUT_OBJECT = 'INPUT_OBJECT',
  LIST = 'LIST',
  NON_NULL = 'NON_NULL',
  SEMANTIC_NULLABLE = 'SEMANTIC_NULLABLE',
}
export { TypeKind };

export const __TypeKind: GraphQLEnumType = new GraphQLEnumType({
  name: '__TypeKind',
  description: 'An enum describing what kind of type a given `__Type` is.',
  values: {
    SCALAR: {
      value: TypeKind.SCALAR,
      description: 'Indicates this type is a scalar.',
    },
    OBJECT: {
      value: TypeKind.OBJECT,
      description:
        'Indicates this type is an object. `fields` and `interfaces` are valid fields.',
    },
    INTERFACE: {
      value: TypeKind.INTERFACE,
      description:
        'Indicates this type is an interface. `fields`, `interfaces`, and `possibleTypes` are valid fields.',
    },
    UNION: {
      value: TypeKind.UNION,
      description:
        'Indicates this type is a union. `possibleTypes` is a valid field.',
    },
    ENUM: {
      value: TypeKind.ENUM,
      description:
        'Indicates this type is an enum. `enumValues` is a valid field.',
    },
    INPUT_OBJECT: {
      value: TypeKind.INPUT_OBJECT,
      description:
        'Indicates this type is an input object. `inputFields` is a valid field.',
    },
    LIST: {
      value: TypeKind.LIST,
      description: 'Indicates this type is a list. `ofType` is a valid field.',
    },
    NON_NULL: {
      value: TypeKind.NON_NULL,
      description:
        'Indicates this type is a non-null. `ofType` is a valid field.',
    },
    SEMANTIC_NULLABLE: {
      value: TypeKind.SEMANTIC_NULLABLE,
      description:
        'Indicates this type is a semantic-nullable. `ofType` is a valid field.',
    },
  },
});

/**
 * Note that these are GraphQLField and not GraphQLFieldConfig,
 * so the format for args is different.
 */

export const SchemaMetaFieldDef: GraphQLField<unknown, unknown> = {
  name: '__schema',
  type: new GraphQLNonNull(__Schema),
  description: 'Access the current type schema of this server.',
  args: [],
  resolve: (_source, _args, _context, { schema }) => schema,
  deprecationReason: undefined,
  extensions: Object.create(null),
  astNode: undefined,
};

export const TypeMetaFieldDef: GraphQLField<unknown, unknown> = {
  name: '__type',
  type: __Type,
  description: 'Request the type information of a single type.',
  args: [
    {
      name: 'name',
      description: undefined,
      type: new GraphQLNonNull(GraphQLString),
      defaultValue: undefined,
      deprecationReason: undefined,
      extensions: Object.create(null),
      astNode: undefined,
    },
  ],
  resolve: (_source, { name }, _context, { schema }) => schema.getType(name),
  deprecationReason: undefined,
  extensions: Object.create(null),
  astNode: undefined,
};

export const TypeNameMetaFieldDef: GraphQLField<unknown, unknown> = {
  name: '__typename',
  type: new GraphQLNonNull(GraphQLString),
  description: 'The name of the current Object type at runtime.',
  args: [],
  resolve: (_source, _args, _context, { parentType }) => parentType.name,
  deprecationReason: undefined,
  extensions: Object.create(null),
  astNode: undefined,
};

export const introspectionTypes: ReadonlyArray<GraphQLNamedType> =
  Object.freeze([
    __Schema,
    __Directive,
    __DirectiveLocation,
    __TypeNullability,
    __Type,
    __Field,
    __InputValue,
    __EnumValue,
    __TypeKind,
  ]);

export function isIntrospectionType(type: GraphQLNamedType): boolean {
  return introspectionTypes.some(({ name }) => type.name === name);
}
