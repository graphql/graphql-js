/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { createIterator, isCollection } from 'iterall';

import { GraphQLError } from '../error';
import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
import isInvalid from '../jsutils/isInvalid';
import keyMap from '../jsutils/keyMap';
import { typeFromAST } from '../utilities/typeFromAST';
import { valueFromAST } from '../utilities/valueFromAST';
import { isValidJSValue } from '../utilities/isValidJSValue';
import { isValidLiteralValue } from '../utilities/isValidLiteralValue';
import * as Kind from '../language/kinds';
import { print } from '../language/printer';
import {
  isInputType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../type/definition';
import type {
  GraphQLInputType,
  GraphQLField,
  GraphQLArgument,
} from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import type { GraphQLSchema } from '../type/schema';
import type {
  FieldNode,
  DirectiveNode,
  ArgumentNode,
  VariableDefinitionNode,
} from '../language/ast';


/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 */
export function getVariableValues(
  schema: GraphQLSchema,
  varDefNodes: Array<VariableDefinitionNode>,
  inputs: { [key: string]: mixed }
): { [key: string]: mixed } {
  const coercedValues = Object.create(null);
  for (let i = 0; i < varDefNodes.length; i++) {
    const varDefNode = varDefNodes[i];
    const varName = varDefNode.variable.name.value;
    const varType = typeFromAST(schema, varDefNode.type);
    if (!isInputType(varType)) {
      throw new GraphQLError(
        `Variable "$${varName}" expected value of type ` +
        `"${print(varDefNode.type)}" which cannot be used as an input type.`,
        [ varDefNode.type ]
      );
    }

    const value = inputs[varName];
    if (isInvalid(value)) {
      const defaultValue = varDefNode.defaultValue;
      if (defaultValue) {
        coercedValues[varName] = valueFromAST(defaultValue, varType);
      }
      if (varType instanceof GraphQLNonNull) {
        throw new GraphQLError(
          `Variable "$${varName}" of required type ` +
          `"${String(varType)}" was not provided.`,
          [ varDefNode ]
        );
      }
    } else {
      const errors = isValidJSValue(value, varType);
      if (errors.length) {
        const message = errors ? '\n' + errors.join('\n') : '';
        throw new GraphQLError(
          `Variable "$${varName}" got invalid value ` +
          `${JSON.stringify(value)}.${message}`,
          [ varDefNode ]
        );
      }

      const coercedValue = coerceValue(varType, value);
      invariant(!isInvalid(coercedValue), 'Should have reported error.');
      coercedValues[varName] = coercedValue;
    }
  }
  return coercedValues;
}

/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 */
export function getArgumentValues(
  def: GraphQLField<*, *> | GraphQLDirective,
  node: FieldNode | DirectiveNode,
  variableValues?: ?{ [key: string]: mixed }
): { [key: string]: mixed } {
  const argDefs = def.args;
  const argNodes = node.arguments || [];
  const coercedValues = Object.create(null);
  const argNodesMap = keyMap(argNodes, arg => arg.name.value);
  for (let i = 0; i < argDefs.length; i++) {
    const argDef = argDefs[i];
    const name = argDef.name;
    const coercedValue = coerceArgumentValue(argDef, argNodesMap[name]);
    if (!isInvalid(coercedValue)) {
      coercedValues[name] = coercedValue;
    }
  }
  return coercedValues;

  function coerceArgumentValue(
    argDef: GraphQLArgument,
    argNode: ?ArgumentNode
  ): mixed {
    const argType = argDef.type;
    const argName = argDef.name;
    let coercedValue = argDef.defaultValue;
    let varName;

    if (argNode && argNode.value.kind === Kind.VARIABLE) {
      varName = argNode.value.name.value;
      const varValue = variableValues && variableValues[varName];
      if (!isInvalid(varValue)) {
        coercedValue = varValue;
      }
    } else if (argNode) {
      const valueNode = argNode.value;
      coercedValue = valueFromAST(valueNode, argType, variableValues);
      if (isInvalid(coercedValue)) {
        const errors = isValidLiteralValue(argType, valueNode);
        throw new GraphQLError(
          `Argument "${argName}" got invalid value ${print(valueNode)}.` +
          (errors ? '\n' + errors.join('\n') : ''),
          [ argNode.value ]
        );
      }
    }

    if (isInvalid(coercedValue) && argType instanceof GraphQLNonNull) {
      const typeStr = String(argType);
      if (argNode && varName) {
        throw new GraphQLError(
          `Argument "${argName}" of required type "${typeStr}" was provided ` +
          `the variable "$${varName}" which was not provided a runtime value.`,
          [ argNode.value ]
        );
      }
      throw new GraphQLError(
        `Argument "${argName}" of required type "${typeStr}" was not provided.`,
        [ node ]
      );
    }

    return coercedValue;
  }
}

/**
 * Given a type and any value, return a runtime value coerced to match the type.
 */
function coerceValue(type: GraphQLInputType, value: mixed): mixed {
  // Ensure flow knows that we treat function params as const.
  const _value = value;

  if (isInvalid(_value)) {
    return; // Intentionally return no value.
  }

  if (type instanceof GraphQLNonNull) {
    if (_value === null) {
      return; // Intentionally return no value.
    }
    return coerceValue(type.ofType, _value);
  }

  if (_value === null) {
    // Intentionally return the value null.
    return null;
  }

  if (type instanceof GraphQLList) {
    const itemType = type.ofType;
    if (isCollection(_value)) {
      const coercedValues = [];
      const valueIter = createIterator(_value);
      if (!valueIter) {
        return; // Intentionally return no value.
      }
      let step;
      while (!(step = valueIter.next()).done) {
        const itemValue = coerceValue(itemType, step.value);
        if (isInvalid(itemValue)) {
          return; // Intentionally return no value.
        }
        coercedValues.push(itemValue);
      }
      return coercedValues;
    }
    const coercedValue = coerceValue(itemType, _value);
    if (isInvalid(coercedValue)) {
      return; // Intentionally return no value.
    }
    return [ coerceValue(itemType, _value) ];
  }

  if (type instanceof GraphQLInputObjectType) {
    if (typeof _value !== 'object') {
      return; // Intentionally return no value.
    }
    const coercedObj = Object.create(null);
    const fields = type.getFields();
    const fieldNames = Object.keys(fields);
    for (let i = 0; i < fieldNames.length; i++) {
      const fieldName = fieldNames[i];
      const field = fields[fieldName];
      if (isInvalid(_value[fieldName])) {
        if (!isInvalid(field.defaultValue)) {
          coercedObj[fieldName] = field.defaultValue;
        } else if (field.type instanceof GraphQLNonNull) {
          return; // Intentionally return no value.
        }
        continue;
      }
      const fieldValue = coerceValue(field.type, _value[fieldName]);
      if (isInvalid(fieldValue)) {
        return; // Intentionally return no value.
      }
      coercedObj[fieldName] = fieldValue;
    }
    return coercedObj;
  }

  invariant(
    type instanceof GraphQLScalarType || type instanceof GraphQLEnumType,
    'Must be input type'
  );

  const parsed = type.parseValue(_value);
  if (isNullish(parsed)) {
    // null or invalid values represent a failure to parse correctly,
    // in which case no value is returned.
    return;
  }

  return parsed;
}
