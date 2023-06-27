'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isIntrospectionType =
  exports.introspectionTypes =
  exports.TypeNameMetaFieldDef =
  exports.TypeMetaFieldDef =
  exports.SchemaMetaFieldDef =
  exports.__TypeKind =
  exports.TypeKind =
  exports.__EnumValue =
  exports.__InputValue =
  exports.__Field =
  exports.__Type =
  exports.__DirectiveLocation =
  exports.__Directive =
  exports.__Schema =
    void 0;
const inspect_js_1 = require('../jsutils/inspect.js');
const invariant_js_1 = require('../jsutils/invariant.js');
const directiveLocation_js_1 = require('../language/directiveLocation.js');
const printer_js_1 = require('../language/printer.js');
const astFromValue_js_1 = require('../utilities/astFromValue.js');
const definition_js_1 = require('./definition.js');
const scalars_js_1 = require('./scalars.js');
exports.__Schema = new definition_js_1.GraphQLObjectType({
  name: '__Schema',
  description:
    'A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.',
  fields: () => ({
    description: {
      type: scalars_js_1.GraphQLString,
      resolve: (schema) => schema.description,
    },
    types: {
      description: 'A list of all types supported by this server.',
      type: new definition_js_1.GraphQLNonNull(
        new definition_js_1.GraphQLList(
          new definition_js_1.GraphQLNonNull(exports.__Type),
        ),
      ),
      resolve(schema) {
        return Object.values(schema.getTypeMap());
      },
    },
    queryType: {
      description: 'The type that query operations will be rooted at.',
      type: new definition_js_1.GraphQLNonNull(exports.__Type),
      resolve: (schema) => schema.getQueryType(),
    },
    mutationType: {
      description:
        'If this server supports mutation, the type that mutation operations will be rooted at.',
      type: exports.__Type,
      resolve: (schema) => schema.getMutationType(),
    },
    subscriptionType: {
      description:
        'If this server support subscription, the type that subscription operations will be rooted at.',
      type: exports.__Type,
      resolve: (schema) => schema.getSubscriptionType(),
    },
    directives: {
      description: 'A list of all directives supported by this server.',
      type: new definition_js_1.GraphQLNonNull(
        new definition_js_1.GraphQLList(
          new definition_js_1.GraphQLNonNull(exports.__Directive),
        ),
      ),
      resolve: (schema) => schema.getDirectives(),
    },
  }),
});
exports.__Directive = new definition_js_1.GraphQLObjectType({
  name: '__Directive',
  description:
    "A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.\n\nIn some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.",
  fields: () => ({
    name: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLString),
      resolve: (directive) => directive.name,
    },
    description: {
      type: scalars_js_1.GraphQLString,
      resolve: (directive) => directive.description,
    },
    isRepeatable: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLBoolean),
      resolve: (directive) => directive.isRepeatable,
    },
    locations: {
      type: new definition_js_1.GraphQLNonNull(
        new definition_js_1.GraphQLList(
          new definition_js_1.GraphQLNonNull(exports.__DirectiveLocation),
        ),
      ),
      resolve: (directive) => directive.locations,
    },
    args: {
      type: new definition_js_1.GraphQLNonNull(
        new definition_js_1.GraphQLList(
          new definition_js_1.GraphQLNonNull(exports.__InputValue),
        ),
      ),
      args: {
        includeDeprecated: {
          type: scalars_js_1.GraphQLBoolean,
          defaultValue: false,
        },
      },
      resolve(field, { includeDeprecated }) {
        return includeDeprecated === true
          ? field.args
          : field.args.filter((arg) => arg.deprecationReason == null);
      },
    },
  }),
});
exports.__DirectiveLocation = new definition_js_1.GraphQLEnumType({
  name: '__DirectiveLocation',
  description:
    'A Directive can be adjacent to many parts of the GraphQL language, a __DirectiveLocation describes one such possible adjacencies.',
  values: {
    QUERY: {
      value: directiveLocation_js_1.DirectiveLocation.QUERY,
      description: 'Location adjacent to a query operation.',
    },
    MUTATION: {
      value: directiveLocation_js_1.DirectiveLocation.MUTATION,
      description: 'Location adjacent to a mutation operation.',
    },
    SUBSCRIPTION: {
      value: directiveLocation_js_1.DirectiveLocation.SUBSCRIPTION,
      description: 'Location adjacent to a subscription operation.',
    },
    FIELD: {
      value: directiveLocation_js_1.DirectiveLocation.FIELD,
      description: 'Location adjacent to a field.',
    },
    FRAGMENT_DEFINITION: {
      value: directiveLocation_js_1.DirectiveLocation.FRAGMENT_DEFINITION,
      description: 'Location adjacent to a fragment definition.',
    },
    FRAGMENT_SPREAD: {
      value: directiveLocation_js_1.DirectiveLocation.FRAGMENT_SPREAD,
      description: 'Location adjacent to a fragment spread.',
    },
    INLINE_FRAGMENT: {
      value: directiveLocation_js_1.DirectiveLocation.INLINE_FRAGMENT,
      description: 'Location adjacent to an inline fragment.',
    },
    VARIABLE_DEFINITION: {
      value: directiveLocation_js_1.DirectiveLocation.VARIABLE_DEFINITION,
      description: 'Location adjacent to a variable definition.',
    },
    SCHEMA: {
      value: directiveLocation_js_1.DirectiveLocation.SCHEMA,
      description: 'Location adjacent to a schema definition.',
    },
    SCALAR: {
      value: directiveLocation_js_1.DirectiveLocation.SCALAR,
      description: 'Location adjacent to a scalar definition.',
    },
    OBJECT: {
      value: directiveLocation_js_1.DirectiveLocation.OBJECT,
      description: 'Location adjacent to an object type definition.',
    },
    FIELD_DEFINITION: {
      value: directiveLocation_js_1.DirectiveLocation.FIELD_DEFINITION,
      description: 'Location adjacent to a field definition.',
    },
    ARGUMENT_DEFINITION: {
      value: directiveLocation_js_1.DirectiveLocation.ARGUMENT_DEFINITION,
      description: 'Location adjacent to an argument definition.',
    },
    INTERFACE: {
      value: directiveLocation_js_1.DirectiveLocation.INTERFACE,
      description: 'Location adjacent to an interface definition.',
    },
    UNION: {
      value: directiveLocation_js_1.DirectiveLocation.UNION,
      description: 'Location adjacent to a union definition.',
    },
    ENUM: {
      value: directiveLocation_js_1.DirectiveLocation.ENUM,
      description: 'Location adjacent to an enum definition.',
    },
    ENUM_VALUE: {
      value: directiveLocation_js_1.DirectiveLocation.ENUM_VALUE,
      description: 'Location adjacent to an enum value definition.',
    },
    INPUT_OBJECT: {
      value: directiveLocation_js_1.DirectiveLocation.INPUT_OBJECT,
      description: 'Location adjacent to an input object type definition.',
    },
    INPUT_FIELD_DEFINITION: {
      value: directiveLocation_js_1.DirectiveLocation.INPUT_FIELD_DEFINITION,
      description: 'Location adjacent to an input object field definition.',
    },
  },
});
exports.__Type = new definition_js_1.GraphQLObjectType({
  name: '__Type',
  description:
    'The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.\n\nDepending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional `specifiedByURL`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.',
  fields: () => ({
    kind: {
      type: new definition_js_1.GraphQLNonNull(exports.__TypeKind),
      resolve(type) {
        if ((0, definition_js_1.isScalarType)(type)) {
          return TypeKind.SCALAR;
        }
        if ((0, definition_js_1.isObjectType)(type)) {
          return TypeKind.OBJECT;
        }
        if ((0, definition_js_1.isInterfaceType)(type)) {
          return TypeKind.INTERFACE;
        }
        if ((0, definition_js_1.isUnionType)(type)) {
          return TypeKind.UNION;
        }
        if ((0, definition_js_1.isEnumType)(type)) {
          return TypeKind.ENUM;
        }
        if ((0, definition_js_1.isInputObjectType)(type)) {
          return TypeKind.INPUT_OBJECT;
        }
        if ((0, definition_js_1.isListType)(type)) {
          return TypeKind.LIST;
        }
        if ((0, definition_js_1.isNonNullType)(type)) {
          return TypeKind.NON_NULL;
        }
        /* c8 ignore next 3 */
        // Not reachable, all possible types have been considered)
        false ||
          (0, invariant_js_1.invariant)(
            false,
            `Unexpected type: "${(0, inspect_js_1.inspect)(type)}".`,
          );
      },
    },
    name: {
      type: scalars_js_1.GraphQLString,
      resolve: (type) => ('name' in type ? type.name : undefined),
    },
    description: {
      type: scalars_js_1.GraphQLString,
      resolve: (type) =>
        // FIXME: add test case
        /* c8 ignore next */
        'description' in type ? type.description : undefined,
    },
    specifiedByURL: {
      type: scalars_js_1.GraphQLString,
      resolve: (obj) =>
        'specifiedByURL' in obj ? obj.specifiedByURL : undefined,
    },
    fields: {
      type: new definition_js_1.GraphQLList(
        new definition_js_1.GraphQLNonNull(exports.__Field),
      ),
      args: {
        includeDeprecated: {
          type: scalars_js_1.GraphQLBoolean,
          defaultValue: false,
        },
      },
      resolve(type, { includeDeprecated }) {
        if (
          (0, definition_js_1.isObjectType)(type) ||
          (0, definition_js_1.isInterfaceType)(type)
        ) {
          const fields = Object.values(type.getFields());
          return includeDeprecated === true
            ? fields
            : fields.filter((field) => field.deprecationReason == null);
        }
      },
    },
    interfaces: {
      type: new definition_js_1.GraphQLList(
        new definition_js_1.GraphQLNonNull(exports.__Type),
      ),
      resolve(type) {
        if (
          (0, definition_js_1.isObjectType)(type) ||
          (0, definition_js_1.isInterfaceType)(type)
        ) {
          return type.getInterfaces();
        }
      },
    },
    possibleTypes: {
      type: new definition_js_1.GraphQLList(
        new definition_js_1.GraphQLNonNull(exports.__Type),
      ),
      resolve(type, _args, _context, { schema }) {
        if ((0, definition_js_1.isAbstractType)(type)) {
          return schema.getPossibleTypes(type);
        }
      },
    },
    enumValues: {
      type: new definition_js_1.GraphQLList(
        new definition_js_1.GraphQLNonNull(exports.__EnumValue),
      ),
      args: {
        includeDeprecated: {
          type: scalars_js_1.GraphQLBoolean,
          defaultValue: false,
        },
      },
      resolve(type, { includeDeprecated }) {
        if ((0, definition_js_1.isEnumType)(type)) {
          const values = type.getValues();
          return includeDeprecated === true
            ? values
            : values.filter((field) => field.deprecationReason == null);
        }
      },
    },
    inputFields: {
      type: new definition_js_1.GraphQLList(
        new definition_js_1.GraphQLNonNull(exports.__InputValue),
      ),
      args: {
        includeDeprecated: {
          type: scalars_js_1.GraphQLBoolean,
          defaultValue: false,
        },
      },
      resolve(type, { includeDeprecated }) {
        if ((0, definition_js_1.isInputObjectType)(type)) {
          const values = Object.values(type.getFields());
          return includeDeprecated === true
            ? values
            : values.filter((field) => field.deprecationReason == null);
        }
      },
    },
    ofType: {
      type: exports.__Type,
      resolve: (type) => ('ofType' in type ? type.ofType : undefined),
    },
    isOneOf: {
      type: scalars_js_1.GraphQLBoolean,
      resolve: (type) => {
        if ((0, definition_js_1.isInputObjectType)(type)) {
          return type.isOneOf;
        }
      },
    },
  }),
});
exports.__Field = new definition_js_1.GraphQLObjectType({
  name: '__Field',
  description:
    'Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type.',
  fields: () => ({
    name: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLString),
      resolve: (field) => field.name,
    },
    description: {
      type: scalars_js_1.GraphQLString,
      resolve: (field) => field.description,
    },
    args: {
      type: new definition_js_1.GraphQLNonNull(
        new definition_js_1.GraphQLList(
          new definition_js_1.GraphQLNonNull(exports.__InputValue),
        ),
      ),
      args: {
        includeDeprecated: {
          type: scalars_js_1.GraphQLBoolean,
          defaultValue: false,
        },
      },
      resolve(field, { includeDeprecated }) {
        return includeDeprecated === true
          ? field.args
          : field.args.filter((arg) => arg.deprecationReason == null);
      },
    },
    type: {
      type: new definition_js_1.GraphQLNonNull(exports.__Type),
      resolve: (field) => field.type,
    },
    isDeprecated: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLBoolean),
      resolve: (field) => field.deprecationReason != null,
    },
    deprecationReason: {
      type: scalars_js_1.GraphQLString,
      resolve: (field) => field.deprecationReason,
    },
  }),
});
exports.__InputValue = new definition_js_1.GraphQLObjectType({
  name: '__InputValue',
  description:
    'Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value.',
  fields: () => ({
    name: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLString),
      resolve: (inputValue) => inputValue.name,
    },
    description: {
      type: scalars_js_1.GraphQLString,
      resolve: (inputValue) => inputValue.description,
    },
    type: {
      type: new definition_js_1.GraphQLNonNull(exports.__Type),
      resolve: (inputValue) => inputValue.type,
    },
    defaultValue: {
      type: scalars_js_1.GraphQLString,
      description:
        'A GraphQL-formatted string representing the default value for this input value.',
      resolve(inputValue) {
        const { type, defaultValue } = inputValue;
        const valueAST = (0, astFromValue_js_1.astFromValue)(
          defaultValue,
          type,
        );
        return valueAST ? (0, printer_js_1.print)(valueAST) : null;
      },
    },
    isDeprecated: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLBoolean),
      resolve: (field) => field.deprecationReason != null,
    },
    deprecationReason: {
      type: scalars_js_1.GraphQLString,
      resolve: (obj) => obj.deprecationReason,
    },
  }),
});
exports.__EnumValue = new definition_js_1.GraphQLObjectType({
  name: '__EnumValue',
  description:
    'One possible value for a given Enum. Enum values are unique values, not a placeholder for a string or numeric value. However an Enum value is returned in a JSON response as a string.',
  fields: () => ({
    name: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLString),
      resolve: (enumValue) => enumValue.name,
    },
    description: {
      type: scalars_js_1.GraphQLString,
      resolve: (enumValue) => enumValue.description,
    },
    isDeprecated: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLBoolean),
      resolve: (enumValue) => enumValue.deprecationReason != null,
    },
    deprecationReason: {
      type: scalars_js_1.GraphQLString,
      resolve: (enumValue) => enumValue.deprecationReason,
    },
  }),
});
var TypeKind;
(function (TypeKind) {
  TypeKind['SCALAR'] = 'SCALAR';
  TypeKind['OBJECT'] = 'OBJECT';
  TypeKind['INTERFACE'] = 'INTERFACE';
  TypeKind['UNION'] = 'UNION';
  TypeKind['ENUM'] = 'ENUM';
  TypeKind['INPUT_OBJECT'] = 'INPUT_OBJECT';
  TypeKind['LIST'] = 'LIST';
  TypeKind['NON_NULL'] = 'NON_NULL';
})((TypeKind = exports.TypeKind || (exports.TypeKind = {})));
exports.__TypeKind = new definition_js_1.GraphQLEnumType({
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
  },
});
/**
 * Note that these are GraphQLField and not GraphQLFieldConfig,
 * so the format for args is different.
 */
exports.SchemaMetaFieldDef = {
  name: '__schema',
  type: new definition_js_1.GraphQLNonNull(exports.__Schema),
  description: 'Access the current type schema of this server.',
  args: [],
  resolve: (_source, _args, _context, { schema }) => schema,
  deprecationReason: undefined,
  extensions: Object.create(null),
  astNode: undefined,
};
exports.TypeMetaFieldDef = {
  name: '__type',
  type: exports.__Type,
  description: 'Request the type information of a single type.',
  args: [
    {
      name: 'name',
      description: undefined,
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLString),
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
exports.TypeNameMetaFieldDef = {
  name: '__typename',
  type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLString),
  description: 'The name of the current Object type at runtime.',
  args: [],
  resolve: (_source, _args, _context, { parentType }) => parentType.name,
  deprecationReason: undefined,
  extensions: Object.create(null),
  astNode: undefined,
};
exports.introspectionTypes = Object.freeze([
  exports.__Schema,
  exports.__Directive,
  exports.__DirectiveLocation,
  exports.__Type,
  exports.__Field,
  exports.__InputValue,
  exports.__EnumValue,
  exports.__TypeKind,
]);
function isIntrospectionType(type) {
  return exports.introspectionTypes.some(({ name }) => type.name === name);
}
exports.isIntrospectionType = isIntrospectionType;
