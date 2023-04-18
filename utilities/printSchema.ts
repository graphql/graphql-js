import { inspect } from '../jsutils/inspect.ts';
import { invariant } from '../jsutils/invariant.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import { isPrintableAsBlockString } from '../language/blockString.ts';
import { Kind } from '../language/kinds.ts';
import { print } from '../language/printer.ts';
import type {
  GraphQLArgument,
  GraphQLEnumType,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
} from '../type/definition.ts';
import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
} from '../type/definition.ts';
import type { GraphQLDirective } from '../type/directives.ts';
import {
  DEFAULT_DEPRECATION_REASON,
  isSpecifiedDirective,
} from '../type/directives.ts';
import { isIntrospectionType } from '../type/introspection.ts';
import { isSpecifiedScalarType } from '../type/scalars.ts';
import type { GraphQLSchema } from '../type/schema.ts';
import { astFromValue } from './astFromValue.ts';
export function printSchema(schema: GraphQLSchema): string {
  return printFilteredSchema(
    schema,
    (n) => !isSpecifiedDirective(n),
    isDefinedType,
  );
}
export function printIntrospectionSchema(schema: GraphQLSchema): string {
  return printFilteredSchema(schema, isSpecifiedDirective, isIntrospectionType);
}
function isDefinedType(type: GraphQLNamedType): boolean {
  return !isSpecifiedScalarType(type) && !isIntrospectionType(type);
}
function printFilteredSchema(
  schema: GraphQLSchema,
  directiveFilter: (type: GraphQLDirective) => boolean,
  typeFilter: (type: GraphQLNamedType) => boolean,
): string {
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
function printSchemaDefinition(schema: GraphQLSchema): Maybe<string> {
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
function hasDefaultRootOperationTypes(schema: GraphQLSchema): boolean {
  /* eslint-disable eqeqeq */
  return (
    schema.getQueryType() == schema.getType('Query') &&
    schema.getMutationType() == schema.getType('Mutation') &&
    schema.getSubscriptionType() == schema.getType('Subscription')
  );
}
export function printType(type: GraphQLNamedType): string {
  if (isScalarType(type)) {
    return printScalar(type);
  }
  if (isObjectType(type)) {
    return printObject(type);
  }
  if (isInterfaceType(type)) {
    return printInterface(type);
  }
  if (isUnionType(type)) {
    return printUnion(type);
  }
  if (isEnumType(type)) {
    return printEnum(type);
  }
  if (isInputObjectType(type)) {
    return printInputObject(type);
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.
  false || invariant(false, 'Unexpected type: ' + inspect(type));
}
function printScalar(type: GraphQLScalarType): string {
  return (
    printDescription(type) + `scalar ${type.name}` + printSpecifiedByURL(type)
  );
}
function printImplementedInterfaces(
  type: GraphQLObjectType | GraphQLInterfaceType,
): string {
  const interfaces = type.getInterfaces();
  return interfaces.length
    ? ' implements ' + interfaces.map((i) => i.name).join(' & ')
    : '';
}
function printObject(type: GraphQLObjectType): string {
  return (
    printDescription(type) +
    `type ${type.name}` +
    printImplementedInterfaces(type) +
    printFields(type)
  );
}
function printInterface(type: GraphQLInterfaceType): string {
  return (
    printDescription(type) +
    `interface ${type.name}` +
    printImplementedInterfaces(type) +
    printFields(type)
  );
}
function printUnion(type: GraphQLUnionType): string {
  const types = type.getTypes();
  const possibleTypes = types.length ? ' = ' + types.join(' | ') : '';
  return printDescription(type) + 'union ' + type.name + possibleTypes;
}
function printEnum(type: GraphQLEnumType): string {
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
function printInputObject(type: GraphQLInputObjectType): string {
  const fields = Object.values(type.getFields()).map(
    (f, i) => printDescription(f, '  ', !i) + '  ' + printInputValue(f),
  );
  return printDescription(type) + `input ${type.name}` + printBlock(fields);
}
function printFields(type: GraphQLObjectType | GraphQLInterfaceType): string {
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
function printBlock(items: ReadonlyArray<string>): string {
  return items.length !== 0 ? ' {\n' + items.join('\n') + '\n}' : '';
}
function printArgs(
  args: ReadonlyArray<GraphQLArgument>,
  indentation: string = '',
): string {
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
function printInputValue(arg: GraphQLInputField): string {
  const defaultAST = astFromValue(arg.defaultValue, arg.type);
  let argDecl = arg.name + ': ' + String(arg.type);
  if (defaultAST) {
    argDecl += ` = ${print(defaultAST)}`;
  }
  return argDecl + printDeprecated(arg.deprecationReason);
}
export function printDirective(directive: GraphQLDirective): string {
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
function printDeprecated(reason: Maybe<string>): string {
  if (reason == null) {
    return '';
  }
  if (reason !== DEFAULT_DEPRECATION_REASON) {
    const astValue = print({ kind: Kind.STRING, value: reason });
    return ` @deprecated(reason: ${astValue})`;
  }
  return ' @deprecated';
}
function printSpecifiedByURL(scalar: GraphQLScalarType): string {
  if (scalar.specifiedByURL == null) {
    return '';
  }
  const astValue = print({
    kind: Kind.STRING,
    value: scalar.specifiedByURL,
  });
  return ` @specifiedBy(url: ${astValue})`;
}
function printDescription(
  def: {
    readonly description: Maybe<string>;
  },
  indentation: string = '',
  firstInBlock: boolean = true,
): string {
  const { description } = def;
  if (description == null) {
    return '';
  }
  const blockString = print({
    kind: Kind.STRING,
    value: description,
    block: isPrintableAsBlockString(description),
  });
  const prefix =
    indentation && !firstInBlock ? '\n' + indentation : indentation;
  return prefix + blockString.replaceAll('\n', '\n' + indentation) + '\n';
}
