'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.buildClientSchema = void 0;
const devAssert_js_1 = require('../jsutils/devAssert.js');
const inspect_js_1 = require('../jsutils/inspect.js');
const isObjectLike_js_1 = require('../jsutils/isObjectLike.js');
const keyValMap_js_1 = require('../jsutils/keyValMap.js');
const parser_js_1 = require('../language/parser.js');
const definition_js_1 = require('../type/definition.js');
const directives_js_1 = require('../type/directives.js');
const introspection_js_1 = require('../type/introspection.js');
const scalars_js_1 = require('../type/scalars.js');
const schema_js_1 = require('../type/schema.js');
const valueFromAST_js_1 = require('./valueFromAST.js');
/**
 * Build a GraphQLSchema for use by client tools.
 *
 * Given the result of a client running the introspection query, creates and
 * returns a GraphQLSchema instance which can be then used with all graphql-js
 * tools, but cannot be used to execute a query, as introspection does not
 * represent the "resolver", "parse" or "serialize" functions or any other
 * server-internal mechanisms.
 *
 * This function expects a complete introspection result. Don't forget to check
 * the "errors" field of a server response before calling this function.
 */
function buildClientSchema(introspection, options) {
  // Even though the `introspection` argument is typed, in most cases it's received
  // as an untyped value from the server, so we will do an additional check here.
  ((0, isObjectLike_js_1.isObjectLike)(introspection) &&
    (0, isObjectLike_js_1.isObjectLike)(introspection.__schema)) ||
    (0, devAssert_js_1.devAssert)(
      false,
      `Invalid or incomplete introspection result. Ensure that you are passing "data" property of introspection response and no "errors" was returned alongside: ${(0,
      inspect_js_1.inspect)(introspection)}.`,
    );
  // Get the schema from the introspection result.
  const schemaIntrospection = introspection.__schema;
  // Iterate through all types, getting the type definition for each.
  const typeMap = new Map(
    schemaIntrospection.types.map((typeIntrospection) => [
      typeIntrospection.name,
      buildType(typeIntrospection),
    ]),
  );
  // Include standard types only if they are used.
  for (const stdType of [
    ...scalars_js_1.specifiedScalarTypes,
    ...introspection_js_1.introspectionTypes,
  ]) {
    if (typeMap.has(stdType.name)) {
      typeMap.set(stdType.name, stdType);
    }
  }
  // Get the root Query, Mutation, and Subscription types.
  const queryType =
    schemaIntrospection.queryType != null
      ? getObjectType(schemaIntrospection.queryType)
      : null;
  const mutationType =
    schemaIntrospection.mutationType != null
      ? getObjectType(schemaIntrospection.mutationType)
      : null;
  const subscriptionType =
    schemaIntrospection.subscriptionType != null
      ? getObjectType(schemaIntrospection.subscriptionType)
      : null;
  // Get the directives supported by Introspection, assuming empty-set if
  // directives were not queried for.
  const directives =
    schemaIntrospection.directives != null
      ? schemaIntrospection.directives.map(buildDirective)
      : [];
  // Then produce and return a Schema with these types.
  return new schema_js_1.GraphQLSchema({
    description: schemaIntrospection.description,
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types: [...typeMap.values()],
    directives,
    assumeValid: options?.assumeValid,
  });
  // Given a type reference in introspection, return the GraphQLType instance.
  // preferring cached instances before building new instances.
  function getType(typeRef) {
    if (typeRef.kind === introspection_js_1.TypeKind.LIST) {
      const itemRef = typeRef.ofType;
      if (itemRef == null) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      return new definition_js_1.GraphQLList(getType(itemRef));
    }
    if (typeRef.kind === introspection_js_1.TypeKind.NON_NULL) {
      const nullableRef = typeRef.ofType;
      if (nullableRef == null) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      const nullableType = getType(nullableRef);
      return new definition_js_1.GraphQLNonNull(
        (0, definition_js_1.assertNullableType)(nullableType),
      );
    }
    return getNamedType(typeRef);
  }
  function getNamedType(typeRef) {
    const typeName = typeRef.name;
    if (!typeName) {
      throw new Error(
        `Unknown type reference: ${(0, inspect_js_1.inspect)(typeRef)}.`,
      );
    }
    const type = typeMap.get(typeName);
    if (type == null) {
      throw new Error(
        `Invalid or incomplete schema, unknown type: ${typeName}. Ensure that a full introspection query is used in order to build a client schema.`,
      );
    }
    return type;
  }
  function getObjectType(typeRef) {
    return (0, definition_js_1.assertObjectType)(getNamedType(typeRef));
  }
  function getInterfaceType(typeRef) {
    return (0, definition_js_1.assertInterfaceType)(getNamedType(typeRef));
  }
  // Given a type's introspection result, construct the correct
  // GraphQLType instance.
  function buildType(type) {
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (type != null && type.name != null && type.kind != null) {
      // FIXME: Properly type IntrospectionType, it's a breaking change so fix in v17
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
      switch (type.kind) {
        case introspection_js_1.TypeKind.SCALAR:
          return buildScalarDef(type);
        case introspection_js_1.TypeKind.OBJECT:
          return buildObjectDef(type);
        case introspection_js_1.TypeKind.INTERFACE:
          return buildInterfaceDef(type);
        case introspection_js_1.TypeKind.UNION:
          return buildUnionDef(type);
        case introspection_js_1.TypeKind.ENUM:
          return buildEnumDef(type);
        case introspection_js_1.TypeKind.INPUT_OBJECT:
          return buildInputObjectDef(type);
      }
    }
    const typeStr = (0, inspect_js_1.inspect)(type);
    throw new Error(
      `Invalid or incomplete introspection result. Ensure that a full introspection query is used in order to build a client schema: ${typeStr}.`,
    );
  }
  function buildScalarDef(scalarIntrospection) {
    return new definition_js_1.GraphQLScalarType({
      name: scalarIntrospection.name,
      description: scalarIntrospection.description,
      specifiedByURL: scalarIntrospection.specifiedByURL,
    });
  }
  function buildImplementationsList(implementingIntrospection) {
    // TODO: Temporary workaround until GraphQL ecosystem will fully support
    // 'interfaces' on interface types.
    if (
      implementingIntrospection.interfaces === null &&
      implementingIntrospection.kind === introspection_js_1.TypeKind.INTERFACE
    ) {
      return [];
    }
    if (implementingIntrospection.interfaces == null) {
      const implementingIntrospectionStr = (0, inspect_js_1.inspect)(
        implementingIntrospection,
      );
      throw new Error(
        `Introspection result missing interfaces: ${implementingIntrospectionStr}.`,
      );
    }
    return implementingIntrospection.interfaces.map(getInterfaceType);
  }
  function buildObjectDef(objectIntrospection) {
    return new definition_js_1.GraphQLObjectType({
      name: objectIntrospection.name,
      description: objectIntrospection.description,
      interfaces: () => buildImplementationsList(objectIntrospection),
      fields: () => buildFieldDefMap(objectIntrospection),
    });
  }
  function buildInterfaceDef(interfaceIntrospection) {
    return new definition_js_1.GraphQLInterfaceType({
      name: interfaceIntrospection.name,
      description: interfaceIntrospection.description,
      interfaces: () => buildImplementationsList(interfaceIntrospection),
      fields: () => buildFieldDefMap(interfaceIntrospection),
    });
  }
  function buildUnionDef(unionIntrospection) {
    if (unionIntrospection.possibleTypes == null) {
      const unionIntrospectionStr = (0, inspect_js_1.inspect)(
        unionIntrospection,
      );
      throw new Error(
        `Introspection result missing possibleTypes: ${unionIntrospectionStr}.`,
      );
    }
    return new definition_js_1.GraphQLUnionType({
      name: unionIntrospection.name,
      description: unionIntrospection.description,
      types: () => unionIntrospection.possibleTypes.map(getObjectType),
    });
  }
  function buildEnumDef(enumIntrospection) {
    if (enumIntrospection.enumValues == null) {
      const enumIntrospectionStr = (0, inspect_js_1.inspect)(enumIntrospection);
      throw new Error(
        `Introspection result missing enumValues: ${enumIntrospectionStr}.`,
      );
    }
    return new definition_js_1.GraphQLEnumType({
      name: enumIntrospection.name,
      description: enumIntrospection.description,
      values: (0, keyValMap_js_1.keyValMap)(
        enumIntrospection.enumValues,
        (valueIntrospection) => valueIntrospection.name,
        (valueIntrospection) => ({
          description: valueIntrospection.description,
          deprecationReason: valueIntrospection.deprecationReason,
        }),
      ),
    });
  }
  function buildInputObjectDef(inputObjectIntrospection) {
    if (inputObjectIntrospection.inputFields == null) {
      const inputObjectIntrospectionStr = (0, inspect_js_1.inspect)(
        inputObjectIntrospection,
      );
      throw new Error(
        `Introspection result missing inputFields: ${inputObjectIntrospectionStr}.`,
      );
    }
    return new definition_js_1.GraphQLInputObjectType({
      name: inputObjectIntrospection.name,
      description: inputObjectIntrospection.description,
      fields: () => buildInputValueDefMap(inputObjectIntrospection.inputFields),
    });
  }
  function buildFieldDefMap(typeIntrospection) {
    if (typeIntrospection.fields == null) {
      throw new Error(
        `Introspection result missing fields: ${(0, inspect_js_1.inspect)(
          typeIntrospection,
        )}.`,
      );
    }
    return (0, keyValMap_js_1.keyValMap)(
      typeIntrospection.fields,
      (fieldIntrospection) => fieldIntrospection.name,
      buildField,
    );
  }
  function buildField(fieldIntrospection) {
    const type = getType(fieldIntrospection.type);
    if (!(0, definition_js_1.isOutputType)(type)) {
      const typeStr = (0, inspect_js_1.inspect)(type);
      throw new Error(
        `Introspection must provide output type for fields, but received: ${typeStr}.`,
      );
    }
    if (fieldIntrospection.args == null) {
      const fieldIntrospectionStr = (0, inspect_js_1.inspect)(
        fieldIntrospection,
      );
      throw new Error(
        `Introspection result missing field args: ${fieldIntrospectionStr}.`,
      );
    }
    return {
      description: fieldIntrospection.description,
      deprecationReason: fieldIntrospection.deprecationReason,
      type,
      args: buildInputValueDefMap(fieldIntrospection.args),
    };
  }
  function buildInputValueDefMap(inputValueIntrospections) {
    return (0, keyValMap_js_1.keyValMap)(
      inputValueIntrospections,
      (inputValue) => inputValue.name,
      buildInputValue,
    );
  }
  function buildInputValue(inputValueIntrospection) {
    const type = getType(inputValueIntrospection.type);
    if (!(0, definition_js_1.isInputType)(type)) {
      const typeStr = (0, inspect_js_1.inspect)(type);
      throw new Error(
        `Introspection must provide input type for arguments, but received: ${typeStr}.`,
      );
    }
    const defaultValue =
      inputValueIntrospection.defaultValue != null
        ? (0, valueFromAST_js_1.valueFromAST)(
            (0, parser_js_1.parseValue)(inputValueIntrospection.defaultValue),
            type,
          )
        : undefined;
    return {
      description: inputValueIntrospection.description,
      type,
      defaultValue,
      deprecationReason: inputValueIntrospection.deprecationReason,
    };
  }
  function buildDirective(directiveIntrospection) {
    if (directiveIntrospection.args == null) {
      const directiveIntrospectionStr = (0, inspect_js_1.inspect)(
        directiveIntrospection,
      );
      throw new Error(
        `Introspection result missing directive args: ${directiveIntrospectionStr}.`,
      );
    }
    if (directiveIntrospection.locations == null) {
      const directiveIntrospectionStr = (0, inspect_js_1.inspect)(
        directiveIntrospection,
      );
      throw new Error(
        `Introspection result missing directive locations: ${directiveIntrospectionStr}.`,
      );
    }
    return new directives_js_1.GraphQLDirective({
      name: directiveIntrospection.name,
      description: directiveIntrospection.description,
      isRepeatable: directiveIntrospection.isRepeatable,
      locations: directiveIntrospection.locations.slice(),
      args: buildInputValueDefMap(directiveIntrospection.args),
    });
  }
}
exports.buildClientSchema = buildClientSchema;
