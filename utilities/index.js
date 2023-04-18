'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.findDangerousChanges =
  exports.findBreakingChanges =
  exports.DangerousChangeType =
  exports.BreakingChangeType =
  exports.doTypesOverlap =
  exports.isTypeSubTypeOf =
  exports.isEqualType =
  exports.stripIgnoredCharacters =
  exports.separateOperations =
  exports.concatAST =
  exports.coerceInputValue =
  exports.visitWithTypeInfo =
  exports.TypeInfo =
  exports.astFromValue =
  exports.valueFromASTUntyped =
  exports.valueFromAST =
  exports.typeFromAST =
  exports.printIntrospectionSchema =
  exports.printDirective =
  exports.printType =
  exports.printSchema =
  exports.lexicographicSortSchema =
  exports.extendSchema =
  exports.buildSchema =
  exports.buildASTSchema =
  exports.buildClientSchema =
  exports.introspectionFromSchema =
  exports.getOperationAST =
  exports.getIntrospectionQuery =
    void 0;
// Produce the GraphQL query recommended for a full schema introspection.
var getIntrospectionQuery_js_1 = require('./getIntrospectionQuery.js');
Object.defineProperty(exports, 'getIntrospectionQuery', {
  enumerable: true,
  get: function () {
    return getIntrospectionQuery_js_1.getIntrospectionQuery;
  },
});
// Gets the target Operation from a Document.
var getOperationAST_js_1 = require('./getOperationAST.js');
Object.defineProperty(exports, 'getOperationAST', {
  enumerable: true,
  get: function () {
    return getOperationAST_js_1.getOperationAST;
  },
});
// Convert a GraphQLSchema to an IntrospectionQuery.
var introspectionFromSchema_js_1 = require('./introspectionFromSchema.js');
Object.defineProperty(exports, 'introspectionFromSchema', {
  enumerable: true,
  get: function () {
    return introspectionFromSchema_js_1.introspectionFromSchema;
  },
});
// Build a GraphQLSchema from an introspection result.
var buildClientSchema_js_1 = require('./buildClientSchema.js');
Object.defineProperty(exports, 'buildClientSchema', {
  enumerable: true,
  get: function () {
    return buildClientSchema_js_1.buildClientSchema;
  },
});
// Build a GraphQLSchema from GraphQL Schema language.
var buildASTSchema_js_1 = require('./buildASTSchema.js');
Object.defineProperty(exports, 'buildASTSchema', {
  enumerable: true,
  get: function () {
    return buildASTSchema_js_1.buildASTSchema;
  },
});
Object.defineProperty(exports, 'buildSchema', {
  enumerable: true,
  get: function () {
    return buildASTSchema_js_1.buildSchema;
  },
});
// Extends an existing GraphQLSchema from a parsed GraphQL Schema language AST.
var extendSchema_js_1 = require('./extendSchema.js');
Object.defineProperty(exports, 'extendSchema', {
  enumerable: true,
  get: function () {
    return extendSchema_js_1.extendSchema;
  },
});
// Sort a GraphQLSchema.
var lexicographicSortSchema_js_1 = require('./lexicographicSortSchema.js');
Object.defineProperty(exports, 'lexicographicSortSchema', {
  enumerable: true,
  get: function () {
    return lexicographicSortSchema_js_1.lexicographicSortSchema;
  },
});
// Print a GraphQLSchema to GraphQL Schema language.
var printSchema_js_1 = require('./printSchema.js');
Object.defineProperty(exports, 'printSchema', {
  enumerable: true,
  get: function () {
    return printSchema_js_1.printSchema;
  },
});
Object.defineProperty(exports, 'printType', {
  enumerable: true,
  get: function () {
    return printSchema_js_1.printType;
  },
});
Object.defineProperty(exports, 'printDirective', {
  enumerable: true,
  get: function () {
    return printSchema_js_1.printDirective;
  },
});
Object.defineProperty(exports, 'printIntrospectionSchema', {
  enumerable: true,
  get: function () {
    return printSchema_js_1.printIntrospectionSchema;
  },
});
// Create a GraphQLType from a GraphQL language AST.
var typeFromAST_js_1 = require('./typeFromAST.js');
Object.defineProperty(exports, 'typeFromAST', {
  enumerable: true,
  get: function () {
    return typeFromAST_js_1.typeFromAST;
  },
});
// Create a JavaScript value from a GraphQL language AST with a type.
var valueFromAST_js_1 = require('./valueFromAST.js');
Object.defineProperty(exports, 'valueFromAST', {
  enumerable: true,
  get: function () {
    return valueFromAST_js_1.valueFromAST;
  },
});
// Create a JavaScript value from a GraphQL language AST without a type.
var valueFromASTUntyped_js_1 = require('./valueFromASTUntyped.js');
Object.defineProperty(exports, 'valueFromASTUntyped', {
  enumerable: true,
  get: function () {
    return valueFromASTUntyped_js_1.valueFromASTUntyped;
  },
});
// Create a GraphQL language AST from a JavaScript value.
var astFromValue_js_1 = require('./astFromValue.js');
Object.defineProperty(exports, 'astFromValue', {
  enumerable: true,
  get: function () {
    return astFromValue_js_1.astFromValue;
  },
});
// A helper to use within recursive-descent visitors which need to be aware of the GraphQL type system.
var TypeInfo_js_1 = require('./TypeInfo.js');
Object.defineProperty(exports, 'TypeInfo', {
  enumerable: true,
  get: function () {
    return TypeInfo_js_1.TypeInfo;
  },
});
Object.defineProperty(exports, 'visitWithTypeInfo', {
  enumerable: true,
  get: function () {
    return TypeInfo_js_1.visitWithTypeInfo;
  },
});
// Coerces a JavaScript value to a GraphQL type, or produces errors.
var coerceInputValue_js_1 = require('./coerceInputValue.js');
Object.defineProperty(exports, 'coerceInputValue', {
  enumerable: true,
  get: function () {
    return coerceInputValue_js_1.coerceInputValue;
  },
});
// Concatenates multiple AST together.
var concatAST_js_1 = require('./concatAST.js');
Object.defineProperty(exports, 'concatAST', {
  enumerable: true,
  get: function () {
    return concatAST_js_1.concatAST;
  },
});
// Separates an AST into an AST per Operation.
var separateOperations_js_1 = require('./separateOperations.js');
Object.defineProperty(exports, 'separateOperations', {
  enumerable: true,
  get: function () {
    return separateOperations_js_1.separateOperations;
  },
});
// Strips characters that are not significant to the validity or execution of a GraphQL document.
var stripIgnoredCharacters_js_1 = require('./stripIgnoredCharacters.js');
Object.defineProperty(exports, 'stripIgnoredCharacters', {
  enumerable: true,
  get: function () {
    return stripIgnoredCharacters_js_1.stripIgnoredCharacters;
  },
});
// Comparators for types
var typeComparators_js_1 = require('./typeComparators.js');
Object.defineProperty(exports, 'isEqualType', {
  enumerable: true,
  get: function () {
    return typeComparators_js_1.isEqualType;
  },
});
Object.defineProperty(exports, 'isTypeSubTypeOf', {
  enumerable: true,
  get: function () {
    return typeComparators_js_1.isTypeSubTypeOf;
  },
});
Object.defineProperty(exports, 'doTypesOverlap', {
  enumerable: true,
  get: function () {
    return typeComparators_js_1.doTypesOverlap;
  },
});
// Compares two GraphQLSchemas and detects breaking changes.
var findBreakingChanges_js_1 = require('./findBreakingChanges.js');
Object.defineProperty(exports, 'BreakingChangeType', {
  enumerable: true,
  get: function () {
    return findBreakingChanges_js_1.BreakingChangeType;
  },
});
Object.defineProperty(exports, 'DangerousChangeType', {
  enumerable: true,
  get: function () {
    return findBreakingChanges_js_1.DangerousChangeType;
  },
});
Object.defineProperty(exports, 'findBreakingChanges', {
  enumerable: true,
  get: function () {
    return findBreakingChanges_js_1.findBreakingChanges;
  },
});
Object.defineProperty(exports, 'findDangerousChanges', {
  enumerable: true,
  get: function () {
    return findBreakingChanges_js_1.findDangerousChanges;
  },
});
