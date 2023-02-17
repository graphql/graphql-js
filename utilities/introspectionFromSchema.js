'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.introspectionFromSchema = void 0;
const invariant_js_1 = require('../jsutils/invariant.js');
const parser_js_1 = require('../language/parser.js');
const execute_js_1 = require('../execution/execute.js');
const getIntrospectionQuery_js_1 = require('./getIntrospectionQuery.js');
/**
 * Build an IntrospectionQuery from a GraphQLSchema
 *
 * IntrospectionQuery is useful for utilities that care about type and field
 * relationships, but do not need to traverse through those relationships.
 *
 * This is the inverse of buildClientSchema. The primary use case is outside
 * of the server context, for instance when doing schema comparisons.
 */
function introspectionFromSchema(schema, options) {
  const optionsWithDefaults = {
    specifiedByUrl: true,
    directiveIsRepeatable: true,
    schemaDescription: true,
    inputValueDeprecation: true,
    ...options,
  };
  const document = (0, parser_js_1.parse)(
    (0, getIntrospectionQuery_js_1.getIntrospectionQuery)(optionsWithDefaults),
  );
  const result = (0, execute_js_1.executeSync)({ schema, document });
  (result.errors == null && result.data != null) ||
    (0, invariant_js_1.invariant)(false);
  return result.data;
}
exports.introspectionFromSchema = introspectionFromSchema;
