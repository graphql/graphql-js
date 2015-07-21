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
import keyMap from '../utils/keyMap';
import invariant from '../utils/invariant';
import typeFromAST from '../utils/typeFromAST';
import isNullish from '../utils/isNullish';
import { Kind } from '../language';
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
import type {
  Argument,
  VariableDefinition,
  Variable,
  ArrayValue,
  ObjectValue
} from '../language/ast';


/**
 * Prepares an object map of variables of the correct type based on the provided
 * variable definitions and arbitrary input. If the input cannot be coerced
 * to match the variable definitions, a GraphQLError will be thrown.
 */
export function getVariableValues(
  schema: GraphQLSchema,
  definitionASTs: Array<VariableDefinition>,
  inputs: { [key: string]: any }
): { [key: string]: any } {
  return definitionASTs.reduce((values, defAST) => {
    var varName = defAST.variable.name.value;
    values[varName] = getVariableValue(schema, defAST, inputs[varName]);
    return values;
  }, {});
}


/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 */
export function getArgumentValues(
  argDefs: Array<GraphQLArgument>,
  argASTs: ?Array<Argument>,
  variables: { [key: string]: any }
): { [key: string]: any } {
  var argASTMap = argASTs ? keyMap(argASTs, arg => arg.name.value) : {};
  return argDefs.reduce((result, argDef) => {
    var name = argDef.name;
    if (argASTMap[name]) {
      var valueAST = argASTMap[name].value;
      result[name] = coerceValueAST(argDef.type, valueAST, variables);
    }else {
      result[name] = argDef.defaultValue;
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
  input: ?any
): any {
  var type = typeFromAST(schema, definitionAST.type);
  if (!type || !isInputType(type)) {
    throw new GraphQLError(
      `Variable $${definitionAST.variable.name.value} expected value of type ` +
      `${print(definitionAST.type)} which cannot be used as an input type.`,
      [definitionAST]
    );
  }
  if (isValidValue(type, input)) {
    if (isNullish(input)) {
      var defaultValue = definitionAST.defaultValue;
      if (defaultValue) {
        return coerceValueAST(type, defaultValue);
      }
    }
    return coerceValue(type, input);
  }
  throw new GraphQLError(
    `Variable $${definitionAST.variable.name.value} expected value of type ` +
    `${print(definitionAST.type)} but got: ${JSON.stringify(input)}.`,
    [definitionAST]
  );
}


/**
 * Given a type and any value, return true if that value is valid.
 */
function isValidValue(type: GraphQLInputType, value: any): boolean {
  // A value must be provided if the type is non-null.
  if (type instanceof GraphQLNonNull) {
    if (isNullish(value)) {
      return false;
    }
    return isValidValue(type.ofType, value);
  }

  if (isNullish(value)) {
    return true;
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof GraphQLList) {
    var itemType = type.ofType;
    if (Array.isArray(value)) {
      return value.every(item => isValidValue(itemType, item));
    } else {
      return isValidValue(itemType, value);
    }
  }

  // Input objects check each defined field.
  if (type instanceof GraphQLInputObjectType) {
    if (typeof value !== 'object') {
      return false;
    }
    var fields = type.getFields();

    // Ensure every provided field is defined.
    if (Object.keys(value).some(fieldName => !fields[fieldName])) {
      return false;
    }

    // Ensure every defined field is valid.
    return Object.keys(fields).every(
      fieldName => isValidValue(fields[fieldName].type, value[fieldName])
    );
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  // Scalar/Enum input checks to ensure the type can coerce the value to
  // a non-null value.
  return !isNullish(type.coerce(value));
}


/**
 * Given a type and any value, return a runtime value coerced to match the type.
 */
function coerceValue(type: GraphQLInputType, value: any): any {
  if (type instanceof GraphQLNonNull) {
    // Note: we're not checking that the result of coerceValue is non-null.
    // We only call this function after calling isValidValue.
    return coerceValue(type.ofType, value);
  }

  if (isNullish(value)) {
    return null;
  }

  if (type instanceof GraphQLList) {
    var itemType = type.ofType;
    // TODO: support iterable input
    if (Array.isArray(value)) {
      return value.map(item => coerceValue(itemType, item));
    } else {
      return [coerceValue(itemType, value)];
    }
  }

  if (type instanceof GraphQLInputObjectType) {
    var fields = type.getFields();
    return Object.keys(fields).reduce((obj, fieldName) => {
      var field = fields[fieldName];
      var fieldValue = coerceValue(field.type, value[fieldName]);
      obj[fieldName] = fieldValue === null ? field.defaultValue : fieldValue;
      return obj;
    }, {});
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  var coerced = type.coerce(value);
  if (!isNullish(coerced)) {
    return coerced;
  }
}


/**
 * Given a type and a value AST node known to match this type, build a
 * runtime value.
 */
function coerceValueAST(
  type: GraphQLInputType,
  valueAST: any,
  variables?: ?{ [key: string]: any }
) {
  if (type instanceof GraphQLNonNull) {
    // Note: we're not checking that the result of coerceValueAST is non-null.
    // We're assuming that this query has been validated and the value used
    // here is of the correct type.
    return coerceValueAST(type.ofType, valueAST, variables);
  }

  if (!valueAST) {
    return null;
  }

  if (valueAST.kind === Kind.VARIABLE) {
    var variableName = (valueAST: Variable).name.value;
    if (!variables || !variables.hasOwnProperty(variableName)) {
      return null;
    }
    // Note: we're not doing any checking that this variable is correct. We're
    // assuming that this query has been validated and the variable usage here
    // is of the correct type.
    return variables[variableName];
  }

  if (type instanceof GraphQLList) {
    var itemType = type.ofType;
    if (valueAST.kind === Kind.ARRAY) {
      return (valueAST: ArrayValue).values.map(
        itemAST => coerceValueAST(itemType, itemAST, variables)
      );
    } else {
      return [coerceValueAST(itemType, valueAST, variables)];
    }
  }

  if (type instanceof GraphQLInputObjectType) {
    var fields = type.getFields();
    if (valueAST.kind !== Kind.OBJECT) {
      return null;
    }
    var fieldASTs = keyMap(
      (valueAST: ObjectValue).fields,
      field => field.name.value
    );
    return Object.keys(fields).reduce((obj, fieldName) => {
      var field = fields[fieldName];
      var fieldAST = fieldASTs[fieldName];
      var fieldValue =
        coerceValueAST(field.type, fieldAST && fieldAST.value, variables);
      obj[fieldName] = fieldValue === null ? field.defaultValue : fieldValue;
      return obj;
    }, {});
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  var coerced = type.coerceLiteral(valueAST);
  if (!isNullish(coerced)) {
    return coerced;
  }
}
