/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import isNullish from '../jsutils/isNullish';
import isInvalid from '../jsutils/isInvalid';
import objectValues from '../jsutils/objectValues';
import { astFromValue } from '../utilities/astFromValue';
import { print } from '../language/printer';
import type { GraphQLSchema } from '../type/schema';
import {
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
} from '../type/definition';
import type {
  GraphQLNamedType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLInputObjectType,
} from '../type/definition';
import { GraphQLString, isSpecifiedScalarType } from '../type/scalars';
import {
  GraphQLDirective,
  DEFAULT_DEPRECATION_REASON,
  isSpecifiedDirective,
} from '../type/directives';
import { isIntrospectionType } from '../type/introspection';

type Options = {|
  /**
   * Descriptions are defined as preceding string literals, however an older
   * experimental version of the SDL supported preceding comments as
   * descriptions. Set to true to enable this deprecated behavior.
   * This option is provided to ease adoption and will be removed in v16.
   *
   * Default: false
   */
  commentDescriptions?: boolean,
|};

/**
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
export function printSchema(schema: GraphQLSchema, options?: Options): string {
  return printFilteredSchema(
    schema,
    n => !isSpecifiedDirective(n),
    isDefinedType,
    options,
  );
}

export function printIntrospectionSchema(
  schema: GraphQLSchema,
  options?: Options,
): string {
  return printFilteredSchema(
    schema,
    isSpecifiedDirective,
    isIntrospectionType,
    options,
  );
}

function isDefinedType(type: GraphQLNamedType): boolean {
  return !isSpecifiedScalarType(type) && !isIntrospectionType(type);
}

function printFilteredSchema(
  schema: GraphQLSchema,
  directiveFilter: (type: GraphQLDirective) => boolean,
  typeFilter: (type: GraphQLNamedType) => boolean,
  options,
): string {
  const directives = schema.getDirectives().filter(directiveFilter);
  const typeMap = schema.getTypeMap();
  const types = objectValues(typeMap)
    .sort((type1, type2) => type1.name.localeCompare(type2.name))
    .filter(typeFilter);

  return (
    [printSchemaDefinition(schema)]
      .concat(
        directives.map(directive => printDirective(directive, options)),
        types.map(type => printType(type, options)),
      )
      .filter(Boolean)
      .join('\n\n') + '\n'
  );
}

function printSchemaDefinition(schema: GraphQLSchema): ?string {
  if (isSchemaOfCommonNames(schema)) {
    return;
  }

  const operationTypes = [];

  const queryType = schema.getQueryType();
  if (queryType) {
    operationTypes.push(`  query: ${queryType.name}`);
  }

  const mutationType = schema.getMutationType();
  if (mutationType) {
    operationTypes.push(`  mutation: ${mutationType.name}`);
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType) {
    operationTypes.push(`  subscription: ${subscriptionType.name}`);
  }

  return `schema {\n${operationTypes.join('\n')}\n}`;
}

/**
 * GraphQL schema define root types for each type of operation. These types are
 * the same as any other type and can be named in any manner, however there is
 * a common naming convention:
 *
 *   schema {
 *     query: Query
 *     mutation: Mutation
 *   }
 *
 * When using this naming convention, the schema description can be omitted.
 */
function isSchemaOfCommonNames(schema: GraphQLSchema): boolean {
  const queryType = schema.getQueryType();
  if (queryType && queryType.name !== 'Query') {
    return false;
  }

  const mutationType = schema.getMutationType();
  if (mutationType && mutationType.name !== 'Mutation') {
    return false;
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && subscriptionType.name !== 'Subscription') {
    return false;
  }

  return true;
}

export function printType(type: GraphQLNamedType, options?: Options): string {
  if (isScalarType(type)) {
    return printScalar(type, options);
  } else if (isObjectType(type)) {
    return printObject(type, options);
  } else if (isInterfaceType(type)) {
    return printInterface(type, options);
  } else if (isUnionType(type)) {
    return printUnion(type, options);
  } else if (isEnumType(type)) {
    return printEnum(type, options);
  } else if (isInputObjectType(type)) {
    return printInputObject(type, options);
  }
  /* istanbul ignore next */
  throw new Error(`Unknown type: ${(type: empty)}.`);
}

function printScalar(type: GraphQLScalarType, options): string {
  return printDescription(options, type) + `scalar ${type.name}`;
}

function printObject(type: GraphQLObjectType, options): string {
  const interfaces = type.getInterfaces();
  const implementedInterfaces = interfaces.length
    ? ' implements ' + interfaces.map(i => i.name).join(' & ')
    : '';
  return (
    printDescription(options, type) +
    `type ${type.name}${implementedInterfaces} {\n` +
    printFields(options, type) +
    '\n' +
    '}'
  );
}

function printInterface(type: GraphQLInterfaceType, options): string {
  return (
    printDescription(options, type) +
    `interface ${type.name} {\n` +
    printFields(options, type) +
    '\n' +
    '}'
  );
}

function printUnion(type: GraphQLUnionType, options): string {
  return (
    printDescription(options, type) +
    `union ${type.name} = ${type.getTypes().join(' | ')}`
  );
}

function printEnum(type: GraphQLEnumType, options): string {
  return (
    printDescription(options, type) +
    `enum ${type.name} {\n` +
    printEnumValues(type.getValues(), options) +
    '\n' +
    '}'
  );
}

function printEnumValues(values, options): string {
  return values
    .map(
      (value, i) =>
        printDescription(options, value, '  ', !i) +
        '  ' +
        value.name +
        printDeprecated(value),
    )
    .join('\n');
}

function printInputObject(type: GraphQLInputObjectType, options): string {
  const fields = objectValues(type.getFields());
  return (
    printDescription(options, type) +
    `input ${type.name} {\n` +
    fields
      .map(
        (f, i) =>
          printDescription(options, f, '  ', !i) + '  ' + printInputValue(f),
      )
      .join('\n') +
    '\n' +
    '}'
  );
}

function printFields(options, type) {
  const fields = objectValues(type.getFields());
  return fields
    .map(
      (f, i) =>
        printDescription(options, f, '  ', !i) +
        '  ' +
        f.name +
        printArgs(options, f.args, '  ') +
        ': ' +
        String(f.type) +
        printDeprecated(f),
    )
    .join('\n');
}

function printArgs(options, args, indentation = '') {
  if (args.length === 0) {
    return '';
  }

  // If every arg does not have a description, print them on one line.
  if (args.every(arg => !arg.description)) {
    return '(' + args.map(printInputValue).join(', ') + ')';
  }

  return (
    '(\n' +
    args
      .map(
        (arg, i) =>
          printDescription(options, arg, '  ' + indentation, !i) +
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
  let argDecl = arg.name + ': ' + String(arg.type);
  if (!isInvalid(arg.defaultValue)) {
    argDecl += ` = ${print(astFromValue(arg.defaultValue, arg.type))}`;
  }
  return argDecl;
}

function printDirective(directive, options) {
  return (
    printDescription(options, directive) +
    'directive @' +
    directive.name +
    printArgs(options, directive.args) +
    ' on ' +
    directive.locations.join(' | ')
  );
}

function printDeprecated(fieldOrEnumVal) {
  if (!fieldOrEnumVal.isDeprecated) {
    return '';
  }
  const reason = fieldOrEnumVal.deprecationReason;
  if (
    isNullish(reason) ||
    reason === '' ||
    reason === DEFAULT_DEPRECATION_REASON
  ) {
    return ' @deprecated';
  }
  return (
    ' @deprecated(reason: ' + print(astFromValue(reason, GraphQLString)) + ')'
  );
}

function printDescription(
  options,
  def,
  indentation = '',
  firstInBlock = true,
): string {
  if (!def.description) {
    return '';
  }

  const lines = descriptionLines(def.description, 120 - indentation.length);
  if (options && options.commentDescriptions) {
    return printDescriptionWithComments(lines, indentation, firstInBlock);
  }

  let description =
    indentation && !firstInBlock
      ? '\n' + indentation + '"""'
      : indentation + '"""';

  // In some circumstances, a single line can be used for the description.
  if (
    lines.length === 1 &&
    lines[0].length < 70 &&
    lines[0][lines[0].length - 1] !== '"'
  ) {
    return description + escapeQuote(lines[0]) + '"""\n';
  }

  // Format a multi-line block quote to account for leading space.
  const hasLeadingSpace = lines[0][0] === ' ' || lines[0][0] === '\t';
  if (!hasLeadingSpace) {
    description += '\n';
  }
  for (let i = 0; i < lines.length; i++) {
    if (i !== 0 || !hasLeadingSpace) {
      description += indentation;
    }
    description += escapeQuote(lines[i]) + '\n';
  }
  description += indentation + '"""\n';
  return description;
}

function escapeQuote(line) {
  return line.replace(/"""/g, '\\"""');
}

function printDescriptionWithComments(lines, indentation, firstInBlock) {
  let description = indentation && !firstInBlock ? '\n' : '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '') {
      description += indentation + '#\n';
    } else {
      description += indentation + '# ' + lines[i] + '\n';
    }
  }
  return description;
}

function descriptionLines(description: string, maxLen: number): Array<string> {
  const lines = [];
  const rawLines = description.split('\n');
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i] === '') {
      lines.push(rawLines[i]);
    } else {
      // For > 120 character long lines, cut at space boundaries into sublines
      // of ~80 chars.
      const sublines = breakLine(rawLines[i], maxLen);
      for (let j = 0; j < sublines.length; j++) {
        lines.push(sublines[j]);
      }
    }
  }
  return lines;
}

function breakLine(line: string, maxLen: number): Array<string> {
  if (line.length < maxLen + 5) {
    return [line];
  }
  const parts = line.split(new RegExp(`((?: |^).{15,${maxLen - 40}}(?= |$))`));
  if (parts.length < 4) {
    return [line];
  }
  const sublines = [parts[0] + parts[1] + parts[2]];
  for (let i = 3; i < parts.length; i += 2) {
    sublines.push(parts[i].slice(1) + parts[i + 1]);
  }
  return sublines;
}
