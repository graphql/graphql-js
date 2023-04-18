'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.printDirective =
  exports.printType =
  exports.printIntrospectionSchema =
  exports.printSchema =
    void 0;
const inspect_js_1 = require('../jsutils/inspect.js');
const invariant_js_1 = require('../jsutils/invariant.js');
const blockString_js_1 = require('../language/blockString.js');
const kinds_js_1 = require('../language/kinds.js');
const printer_js_1 = require('../language/printer.js');
const definition_js_1 = require('../type/definition.js');
const directives_js_1 = require('../type/directives.js');
const introspection_js_1 = require('../type/introspection.js');
const scalars_js_1 = require('../type/scalars.js');
const astFromValue_js_1 = require('./astFromValue.js');
function printSchema(schema) {
  return printFilteredSchema(
    schema,
    (n) => !(0, directives_js_1.isSpecifiedDirective)(n),
    isDefinedType,
  );
}
exports.printSchema = printSchema;
function printIntrospectionSchema(schema) {
  return printFilteredSchema(
    schema,
    directives_js_1.isSpecifiedDirective,
    introspection_js_1.isIntrospectionType,
  );
}
exports.printIntrospectionSchema = printIntrospectionSchema;
function isDefinedType(type) {
  return (
    !(0, scalars_js_1.isSpecifiedScalarType)(type) &&
    !(0, introspection_js_1.isIntrospectionType)(type)
  );
}
function printFilteredSchema(schema, directiveFilter, typeFilter) {
  const directives = schema.getDirectives().filter(directiveFilter);
  const types = Object.values(schema.getTypeMap()).filter(typeFilter);
  return [
    printSchemaDefinition(schema),
    ...directives.map((directive) => printDirective(directive)),
    ...types.map((type) => printType(type)),
  ]
    .filter(Boolean)
    .join('\n\n');
}
function printSchemaDefinition(schema) {
  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();
  // Special case: When a schema has no root operation types, no valid schema
  // definition can be printed.
  if (!queryType && !mutationType && !subscriptionType) {
    return;
  }
  // Only print a schema definition if there is a description or if it should
  // not be omitted because of having default type names.
  if (schema.description != null || !hasDefaultRootOperationTypes(schema)) {
    return (
      printDescription(schema) +
      'schema {\n' +
      (queryType ? `  query: ${queryType.name}\n` : '') +
      (mutationType ? `  mutation: ${mutationType.name}\n` : '') +
      (subscriptionType ? `  subscription: ${subscriptionType.name}\n` : '') +
      '}'
    );
  }
}
/**
 * GraphQL schema define root types for each type of operation. These types are
 * the same as any other type and can be named in any manner, however there is
 * a common naming convention:
 *
 * ```graphql
 *   schema {
 *     query: Query
 *     mutation: Mutation
 *     subscription: Subscription
 *   }
 * ```
 *
 * When using this naming convention, the schema description can be omitted so
 * long as these names are only used for operation types.
 *
 * Note however that if any of these default names are used elsewhere in the
 * schema but not as a root operation type, the schema definition must still
 * be printed to avoid ambiguity.
 */
function hasDefaultRootOperationTypes(schema) {
  /* eslint-disable eqeqeq */
  return (
    schema.getQueryType() == schema.getType('Query') &&
    schema.getMutationType() == schema.getType('Mutation') &&
    schema.getSubscriptionType() == schema.getType('Subscription')
  );
}
function printType(type) {
  if ((0, definition_js_1.isScalarType)(type)) {
    return printScalar(type);
  }
  if ((0, definition_js_1.isObjectType)(type)) {
    return printObject(type);
  }
  if ((0, definition_js_1.isInterfaceType)(type)) {
    return printInterface(type);
  }
  if ((0, definition_js_1.isUnionType)(type)) {
    return printUnion(type);
  }
  if ((0, definition_js_1.isEnumType)(type)) {
    return printEnum(type);
  }
  if ((0, definition_js_1.isInputObjectType)(type)) {
    return printInputObject(type);
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.
  false ||
    (0, invariant_js_1.invariant)(
      false,
      'Unexpected type: ' + (0, inspect_js_1.inspect)(type),
    );
}
exports.printType = printType;
function printScalar(type) {
  return (
    printDescription(type) + `scalar ${type.name}` + printSpecifiedByURL(type)
  );
}
function printImplementedInterfaces(type) {
  const interfaces = type.getInterfaces();
  return interfaces.length
    ? ' implements ' + interfaces.map((i) => i.name).join(' & ')
    : '';
}
function printObject(type) {
  return (
    printDescription(type) +
    `type ${type.name}` +
    printImplementedInterfaces(type) +
    printFields(type)
  );
}
function printInterface(type) {
  return (
    printDescription(type) +
    `interface ${type.name}` +
    printImplementedInterfaces(type) +
    printFields(type)
  );
}
function printUnion(type) {
  const types = type.getTypes();
  const possibleTypes = types.length ? ' = ' + types.join(' | ') : '';
  return printDescription(type) + 'union ' + type.name + possibleTypes;
}
function printEnum(type) {
  const values = type
    .getValues()
    .map(
      (value, i) =>
        printDescription(value, '  ', !i) +
        '  ' +
        value.name +
        printDeprecated(value.deprecationReason),
    );
  return printDescription(type) + `enum ${type.name}` + printBlock(values);
}
function printInputObject(type) {
  const fields = Object.values(type.getFields()).map(
    (f, i) => printDescription(f, '  ', !i) + '  ' + printInputValue(f),
  );
  return printDescription(type) + `input ${type.name}` + printBlock(fields);
}
function printFields(type) {
  const fields = Object.values(type.getFields()).map(
    (f, i) =>
      printDescription(f, '  ', !i) +
      '  ' +
      f.name +
      printArgs(f.args, '  ') +
      ': ' +
      String(f.type) +
      printDeprecated(f.deprecationReason),
  );
  return printBlock(fields);
}
function printBlock(items) {
  return items.length !== 0 ? ' {\n' + items.join('\n') + '\n}' : '';
}
function printArgs(args, indentation = '') {
  if (args.length === 0) {
    return '';
  }
  // If every arg does not have a description, print them on one line.
  if (args.every((arg) => arg.description == null)) {
    return '(' + args.map(printInputValue).join(', ') + ')';
  }
  return (
    '(\n' +
    args
      .map(
        (arg, i) =>
          printDescription(arg, '  ' + indentation, !i) +
          '  ' +
          indentation +
          printInputValue(arg),
      )
      .join('\n') +
    '\n' +
    indentation +
    ')'
  );
}
function printInputValue(arg) {
  const defaultAST = (0, astFromValue_js_1.astFromValue)(
    arg.defaultValue,
    arg.type,
  );
  let argDecl = arg.name + ': ' + String(arg.type);
  if (defaultAST) {
    argDecl += ` = ${(0, printer_js_1.print)(defaultAST)}`;
  }
  return argDecl + printDeprecated(arg.deprecationReason);
}
function printDirective(directive) {
  return (
    printDescription(directive) +
    'directive @' +
    directive.name +
    printArgs(directive.args) +
    (directive.isRepeatable ? ' repeatable' : '') +
    ' on ' +
    directive.locations.join(' | ')
  );
}
exports.printDirective = printDirective;
function printDeprecated(reason) {
  if (reason == null) {
    return '';
  }
  if (reason !== directives_js_1.DEFAULT_DEPRECATION_REASON) {
    const astValue = (0, printer_js_1.print)({
      kind: kinds_js_1.Kind.STRING,
      value: reason,
    });
    return ` @deprecated(reason: ${astValue})`;
  }
  return ' @deprecated';
}
function printSpecifiedByURL(scalar) {
  if (scalar.specifiedByURL == null) {
    return '';
  }
  const astValue = (0, printer_js_1.print)({
    kind: kinds_js_1.Kind.STRING,
    value: scalar.specifiedByURL,
  });
  return ` @specifiedBy(url: ${astValue})`;
}
function printDescription(def, indentation = '', firstInBlock = true) {
  const { description } = def;
  if (description == null) {
    return '';
  }
  const blockString = (0, printer_js_1.print)({
    kind: kinds_js_1.Kind.STRING,
    value: description,
    block: (0, blockString_js_1.isPrintableAsBlockString)(description),
  });
  const prefix =
    indentation && !firstInBlock ? '\n' + indentation : indentation;
  return prefix + blockString.replaceAll('\n', '\n' + indentation) + '\n';
}
