/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { GraphQLError } from '../error';
import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
import keyMap from '../jsutils/keyMap';
import { typeFromAST } from '../utilities/typeFromAST';
import { valueFromAST } from '../utilities/valueFromAST';
import { isValidJSValue } from '../utilities/isValidJSValue';
import { print } from '../language/printer';
import {
  isInputType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../type/definition';
import type { GraphQLInputType, GraphQLArgument } from '../type/definition';
import type { GraphQLSchema } from '../type/schema';
import type { Argument, VariableDefinition } from '../language/ast';


/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 */
export function getVariableValues(
  schema: GraphQLSchema,
  definitionASTs: Array<VariableDefinition>,
  inputs: { [key: string]: mixed }
): { [key: string]: mixed } {
  return definitionASTs.reduce((values, defAST) => {
    const varName = defAST.variable.name.value;
    values[varName] = getVariableValue(schema, defAST, inputs[varName]);
    return values;
  }, {});
}


/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 */
export function getArgumentValues(
  argDefs: ?Array<GraphQLArgument>,
  argASTs: ?Array<Argument>,
  variableValues?: ?{ [key: string]: mixed }
): { [key: string]: mixed } {
  if (!argDefs || !argASTs) {
    return {};
  }
  const argASTMap = keyMap(argASTs, arg => arg.name.value);
  return argDefs.reduce((result, argDef) => {
    const name = argDef.name;
    const valueAST = argASTMap[name] ? argASTMap[name].value : null;
    let value = valueFromAST(valueAST, argDef.type, variableValues);
    if (isNullish(value)) {
      value = argDef.defaultValue;
    }
    if (!isNullish(value)) {
      result[name] = value;
    }
    return result;
  }, {});
}


/**
 * Given a variable definition, and any value of input, return a value which
 * adheres to the variable definition, or throw an error.
 */
function getVariableValue(
  schema: GraphQLSchema,
  definitionAST: VariableDefinition,
  input: mixed
): mixed {
  const type = typeFromAST(schema, definitionAST.type);
  const variable = definitionAST.variable;
  if (!type || !isInputType(type)) {
    throw new GraphQLError(
      `Variable "$${variable.name.value}" expected value of type ` +
      `"${print(definitionAST.type)}" which cannot be used as an input type.`,
      [ definitionAST ]
    );
  }
  const inputType = ((type: any): GraphQLInputType);
  const errors = isValidJSValue(input, inputType);
  if (!errors.length) {
    if (isNullish(input)) {
      const defaultValue = definitionAST.defaultValue;
      if (defaultValue) {
        return valueFromAST(defaultValue, inputType);
      }
    }
    return coerceValue(inputType, input);
  }
  if (isNullish(input)) {
    throw new GraphQLError(
      `Variable "$${variable.name.value}" of required type ` +
      `"${print(definitionAST.type)}" was not provided.`,
      [ definitionAST ]
    );
  }
  const message = errors ? '\n' + errors.join('\n') : '';
  throw new GraphQLError(
    `Variable "$${variable.name.value}" got invalid value ` +
    `${JSON.stringify(input)}.${message}`,
    [ definitionAST ]
  );
}

/**
 * Given a type and any value, return a runtime value coerced to match the type.
 */
function coerceValue(type: GraphQLInputType, value: mixed): mixed {
  // Ensure flow knows that we treat function params as const.
  const _value = value;

  if (type instanceof GraphQLNonNull) {
    // Note: we're not checking that the result of coerceValue is non-null.
    // We only call this function after calling isValidJSValue.
    return coerceValue(type.ofType, _value);
  }

  if (isNullish(_value)) {
    return null;
  }

  if (type instanceof GraphQLList) {
    const itemType = type.ofType;
    // TODO: support iterable input
    if (Array.isArray(_value)) {
      return _value.map(item => coerceValue(itemType, item));
    }
    return [ coerceValue(itemType, _value) ];
  }

  if (type instanceof GraphQLInputObjectType) {
    if (typeof _value !== 'object' || _value === null) {
      return null;
    }
    const fields = type.getFields();
    return Object.keys(fields).reduce((obj, fieldName) => {
      const field = fields[fieldName];
      let fieldValue = coerceValue(field.type, _value[fieldName]);
      if (isNullish(fieldValue)) {
        fieldValue = field.defaultValue;
      }
      if (!isNullish(fieldValue)) {
        obj[fieldName] = fieldValue;
      }
      return obj;
    }, {});
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  const parsed = type.parseValue(_value);
  if (!isNullish(parsed)) {
    return parsed;
  }
}
