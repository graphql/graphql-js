'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.GraphQLList =
  exports.GraphQLInputObjectType =
  exports.GraphQLEnumType =
  exports.GraphQLUnionType =
  exports.GraphQLInterfaceType =
  exports.GraphQLObjectType =
  exports.GraphQLScalarType =
  exports.getNamedType =
  exports.getNullableType =
  exports.assertNamedType =
  exports.assertNullableType =
  exports.assertWrappingType =
  exports.assertAbstractType =
  exports.assertCompositeType =
  exports.assertLeafType =
  exports.assertOutputType =
  exports.assertInputType =
  exports.assertNonNullType =
  exports.assertListType =
  exports.assertInputObjectType =
  exports.assertEnumType =
  exports.assertUnionType =
  exports.assertInterfaceType =
  exports.assertObjectType =
  exports.assertScalarType =
  exports.assertType =
  exports.isRequiredInputField =
  exports.isRequiredArgument =
  exports.isNamedType =
  exports.isNullableType =
  exports.isWrappingType =
  exports.isAbstractType =
  exports.isCompositeType =
  exports.isLeafType =
  exports.isOutputType =
  exports.isInputType =
  exports.isNonNullType =
  exports.isListType =
  exports.isInputObjectType =
  exports.isEnumType =
  exports.isUnionType =
  exports.isInterfaceType =
  exports.isObjectType =
  exports.isScalarType =
  exports.isType =
  exports.resolveReadonlyArrayThunk =
  exports.resolveObjMapThunk =
  exports.GraphQLSchema =
  exports.assertSchema =
  exports.isSchema =
    void 0;
exports.assertEnumValueName =
  exports.assertName =
  exports.assertValidSchema =
  exports.validateSchema =
  exports.TypeNameMetaFieldDef =
  exports.TypeMetaFieldDef =
  exports.SchemaMetaFieldDef =
  exports.TypeKind =
  exports.__TypeKind =
  exports.__EnumValue =
  exports.__InputValue =
  exports.__Field =
  exports.__Type =
  exports.__DirectiveLocation =
  exports.__Directive =
  exports.__Schema =
  exports.introspectionTypes =
  exports.isIntrospectionType =
  exports.GRAPHQL_MIN_INT =
  exports.GRAPHQL_MAX_INT =
  exports.GraphQLID =
  exports.GraphQLBoolean =
  exports.GraphQLString =
  exports.GraphQLFloat =
  exports.GraphQLInt =
  exports.specifiedScalarTypes =
  exports.isSpecifiedScalarType =
  exports.DEFAULT_DEPRECATION_REASON =
  exports.GraphQLOneOfDirective =
  exports.GraphQLSpecifiedByDirective =
  exports.GraphQLDeprecatedDirective =
  exports.GraphQLStreamDirective =
  exports.GraphQLDeferDirective =
  exports.GraphQLSkipDirective =
  exports.GraphQLIncludeDirective =
  exports.specifiedDirectives =
  exports.isSpecifiedDirective =
  exports.GraphQLDirective =
  exports.assertDirective =
  exports.isDirective =
  exports.GraphQLNonNull =
    void 0;
var schema_js_1 = require('./schema.js');
// Predicate
Object.defineProperty(exports, 'isSchema', {
  enumerable: true,
  get: function () {
    return schema_js_1.isSchema;
  },
});
// Assertion
Object.defineProperty(exports, 'assertSchema', {
  enumerable: true,
  get: function () {
    return schema_js_1.assertSchema;
  },
});
// GraphQL Schema definition
Object.defineProperty(exports, 'GraphQLSchema', {
  enumerable: true,
  get: function () {
    return schema_js_1.GraphQLSchema;
  },
});
var definition_js_1 = require('./definition.js');
Object.defineProperty(exports, 'resolveObjMapThunk', {
  enumerable: true,
  get: function () {
    return definition_js_1.resolveObjMapThunk;
  },
});
Object.defineProperty(exports, 'resolveReadonlyArrayThunk', {
  enumerable: true,
  get: function () {
    return definition_js_1.resolveReadonlyArrayThunk;
  },
});
// Predicates
Object.defineProperty(exports, 'isType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isType;
  },
});
Object.defineProperty(exports, 'isScalarType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isScalarType;
  },
});
Object.defineProperty(exports, 'isObjectType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isObjectType;
  },
});
Object.defineProperty(exports, 'isInterfaceType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isInterfaceType;
  },
});
Object.defineProperty(exports, 'isUnionType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isUnionType;
  },
});
Object.defineProperty(exports, 'isEnumType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isEnumType;
  },
});
Object.defineProperty(exports, 'isInputObjectType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isInputObjectType;
  },
});
Object.defineProperty(exports, 'isListType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isListType;
  },
});
Object.defineProperty(exports, 'isNonNullType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isNonNullType;
  },
});
Object.defineProperty(exports, 'isInputType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isInputType;
  },
});
Object.defineProperty(exports, 'isOutputType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isOutputType;
  },
});
Object.defineProperty(exports, 'isLeafType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isLeafType;
  },
});
Object.defineProperty(exports, 'isCompositeType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isCompositeType;
  },
});
Object.defineProperty(exports, 'isAbstractType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isAbstractType;
  },
});
Object.defineProperty(exports, 'isWrappingType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isWrappingType;
  },
});
Object.defineProperty(exports, 'isNullableType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isNullableType;
  },
});
Object.defineProperty(exports, 'isNamedType', {
  enumerable: true,
  get: function () {
    return definition_js_1.isNamedType;
  },
});
Object.defineProperty(exports, 'isRequiredArgument', {
  enumerable: true,
  get: function () {
    return definition_js_1.isRequiredArgument;
  },
});
Object.defineProperty(exports, 'isRequiredInputField', {
  enumerable: true,
  get: function () {
    return definition_js_1.isRequiredInputField;
  },
});
// Assertions
Object.defineProperty(exports, 'assertType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertType;
  },
});
Object.defineProperty(exports, 'assertScalarType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertScalarType;
  },
});
Object.defineProperty(exports, 'assertObjectType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertObjectType;
  },
});
Object.defineProperty(exports, 'assertInterfaceType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertInterfaceType;
  },
});
Object.defineProperty(exports, 'assertUnionType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertUnionType;
  },
});
Object.defineProperty(exports, 'assertEnumType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertEnumType;
  },
});
Object.defineProperty(exports, 'assertInputObjectType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertInputObjectType;
  },
});
Object.defineProperty(exports, 'assertListType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertListType;
  },
});
Object.defineProperty(exports, 'assertNonNullType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertNonNullType;
  },
});
Object.defineProperty(exports, 'assertInputType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertInputType;
  },
});
Object.defineProperty(exports, 'assertOutputType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertOutputType;
  },
});
Object.defineProperty(exports, 'assertLeafType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertLeafType;
  },
});
Object.defineProperty(exports, 'assertCompositeType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertCompositeType;
  },
});
Object.defineProperty(exports, 'assertAbstractType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertAbstractType;
  },
});
Object.defineProperty(exports, 'assertWrappingType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertWrappingType;
  },
});
Object.defineProperty(exports, 'assertNullableType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertNullableType;
  },
});
Object.defineProperty(exports, 'assertNamedType', {
  enumerable: true,
  get: function () {
    return definition_js_1.assertNamedType;
  },
});
// Un-modifiers
Object.defineProperty(exports, 'getNullableType', {
  enumerable: true,
  get: function () {
    return definition_js_1.getNullableType;
  },
});
Object.defineProperty(exports, 'getNamedType', {
  enumerable: true,
  get: function () {
    return definition_js_1.getNamedType;
  },
});
// Definitions
Object.defineProperty(exports, 'GraphQLScalarType', {
  enumerable: true,
  get: function () {
    return definition_js_1.GraphQLScalarType;
  },
});
Object.defineProperty(exports, 'GraphQLObjectType', {
  enumerable: true,
  get: function () {
    return definition_js_1.GraphQLObjectType;
  },
});
Object.defineProperty(exports, 'GraphQLInterfaceType', {
  enumerable: true,
  get: function () {
    return definition_js_1.GraphQLInterfaceType;
  },
});
Object.defineProperty(exports, 'GraphQLUnionType', {
  enumerable: true,
  get: function () {
    return definition_js_1.GraphQLUnionType;
  },
});
Object.defineProperty(exports, 'GraphQLEnumType', {
  enumerable: true,
  get: function () {
    return definition_js_1.GraphQLEnumType;
  },
});
Object.defineProperty(exports, 'GraphQLInputObjectType', {
  enumerable: true,
  get: function () {
    return definition_js_1.GraphQLInputObjectType;
  },
});
// Type Wrappers
Object.defineProperty(exports, 'GraphQLList', {
  enumerable: true,
  get: function () {
    return definition_js_1.GraphQLList;
  },
});
Object.defineProperty(exports, 'GraphQLNonNull', {
  enumerable: true,
  get: function () {
    return definition_js_1.GraphQLNonNull;
  },
});
var directives_js_1 = require('./directives.js');
// Predicate
Object.defineProperty(exports, 'isDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.isDirective;
  },
});
// Assertion
Object.defineProperty(exports, 'assertDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.assertDirective;
  },
});
// Directives Definition
Object.defineProperty(exports, 'GraphQLDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.GraphQLDirective;
  },
});
// Built-in Directives defined by the Spec
Object.defineProperty(exports, 'isSpecifiedDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.isSpecifiedDirective;
  },
});
Object.defineProperty(exports, 'specifiedDirectives', {
  enumerable: true,
  get: function () {
    return directives_js_1.specifiedDirectives;
  },
});
Object.defineProperty(exports, 'GraphQLIncludeDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.GraphQLIncludeDirective;
  },
});
Object.defineProperty(exports, 'GraphQLSkipDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.GraphQLSkipDirective;
  },
});
Object.defineProperty(exports, 'GraphQLDeferDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.GraphQLDeferDirective;
  },
});
Object.defineProperty(exports, 'GraphQLStreamDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.GraphQLStreamDirective;
  },
});
Object.defineProperty(exports, 'GraphQLDeprecatedDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.GraphQLDeprecatedDirective;
  },
});
Object.defineProperty(exports, 'GraphQLSpecifiedByDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.GraphQLSpecifiedByDirective;
  },
});
Object.defineProperty(exports, 'GraphQLOneOfDirective', {
  enumerable: true,
  get: function () {
    return directives_js_1.GraphQLOneOfDirective;
  },
});
// Constant Deprecation Reason
Object.defineProperty(exports, 'DEFAULT_DEPRECATION_REASON', {
  enumerable: true,
  get: function () {
    return directives_js_1.DEFAULT_DEPRECATION_REASON;
  },
});
// Common built-in scalar instances.
var scalars_js_1 = require('./scalars.js');
// Predicate
Object.defineProperty(exports, 'isSpecifiedScalarType', {
  enumerable: true,
  get: function () {
    return scalars_js_1.isSpecifiedScalarType;
  },
});
// Standard GraphQL Scalars
Object.defineProperty(exports, 'specifiedScalarTypes', {
  enumerable: true,
  get: function () {
    return scalars_js_1.specifiedScalarTypes;
  },
});
Object.defineProperty(exports, 'GraphQLInt', {
  enumerable: true,
  get: function () {
    return scalars_js_1.GraphQLInt;
  },
});
Object.defineProperty(exports, 'GraphQLFloat', {
  enumerable: true,
  get: function () {
    return scalars_js_1.GraphQLFloat;
  },
});
Object.defineProperty(exports, 'GraphQLString', {
  enumerable: true,
  get: function () {
    return scalars_js_1.GraphQLString;
  },
});
Object.defineProperty(exports, 'GraphQLBoolean', {
  enumerable: true,
  get: function () {
    return scalars_js_1.GraphQLBoolean;
  },
});
Object.defineProperty(exports, 'GraphQLID', {
  enumerable: true,
  get: function () {
    return scalars_js_1.GraphQLID;
  },
});
// Int boundaries constants
Object.defineProperty(exports, 'GRAPHQL_MAX_INT', {
  enumerable: true,
  get: function () {
    return scalars_js_1.GRAPHQL_MAX_INT;
  },
});
Object.defineProperty(exports, 'GRAPHQL_MIN_INT', {
  enumerable: true,
  get: function () {
    return scalars_js_1.GRAPHQL_MIN_INT;
  },
});
var introspection_js_1 = require('./introspection.js');
// Predicate
Object.defineProperty(exports, 'isIntrospectionType', {
  enumerable: true,
  get: function () {
    return introspection_js_1.isIntrospectionType;
  },
});
// GraphQL Types for introspection.
Object.defineProperty(exports, 'introspectionTypes', {
  enumerable: true,
  get: function () {
    return introspection_js_1.introspectionTypes;
  },
});
Object.defineProperty(exports, '__Schema', {
  enumerable: true,
  get: function () {
    return introspection_js_1.__Schema;
  },
});
Object.defineProperty(exports, '__Directive', {
  enumerable: true,
  get: function () {
    return introspection_js_1.__Directive;
  },
});
Object.defineProperty(exports, '__DirectiveLocation', {
  enumerable: true,
  get: function () {
    return introspection_js_1.__DirectiveLocation;
  },
});
Object.defineProperty(exports, '__Type', {
  enumerable: true,
  get: function () {
    return introspection_js_1.__Type;
  },
});
Object.defineProperty(exports, '__Field', {
  enumerable: true,
  get: function () {
    return introspection_js_1.__Field;
  },
});
Object.defineProperty(exports, '__InputValue', {
  enumerable: true,
  get: function () {
    return introspection_js_1.__InputValue;
  },
});
Object.defineProperty(exports, '__EnumValue', {
  enumerable: true,
  get: function () {
    return introspection_js_1.__EnumValue;
  },
});
Object.defineProperty(exports, '__TypeKind', {
  enumerable: true,
  get: function () {
    return introspection_js_1.__TypeKind;
  },
});
// "Enum" of Type Kinds
Object.defineProperty(exports, 'TypeKind', {
  enumerable: true,
  get: function () {
    return introspection_js_1.TypeKind;
  },
});
// Meta-field definitions.
Object.defineProperty(exports, 'SchemaMetaFieldDef', {
  enumerable: true,
  get: function () {
    return introspection_js_1.SchemaMetaFieldDef;
  },
});
Object.defineProperty(exports, 'TypeMetaFieldDef', {
  enumerable: true,
  get: function () {
    return introspection_js_1.TypeMetaFieldDef;
  },
});
Object.defineProperty(exports, 'TypeNameMetaFieldDef', {
  enumerable: true,
  get: function () {
    return introspection_js_1.TypeNameMetaFieldDef;
  },
});
// Validate GraphQL schema.
var validate_js_1 = require('./validate.js');
Object.defineProperty(exports, 'validateSchema', {
  enumerable: true,
  get: function () {
    return validate_js_1.validateSchema;
  },
});
Object.defineProperty(exports, 'assertValidSchema', {
  enumerable: true,
  get: function () {
    return validate_js_1.assertValidSchema;
  },
});
// Upholds the spec rules about naming.
var assertName_js_1 = require('./assertName.js');
Object.defineProperty(exports, 'assertName', {
  enumerable: true,
  get: function () {
    return assertName_js_1.assertName;
  },
});
Object.defineProperty(exports, 'assertEnumValueName', {
  enumerable: true,
  get: function () {
    return assertName_js_1.assertEnumValueName;
  },
});
