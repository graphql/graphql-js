/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

export function missingArgMessage(fieldName, argName, typeName) {
  return `Field ${fieldName} argument ${argName} of type ${typeName}, is ` +
    `required but not provided.`;
}

export function badValueMessage(argName, typeName, value) {
  return `Argument ${argName} expected type ${typeName} but got: ${value}.`;
}

export function defaultForNonNullArgMessage(varName, typeName, guessTypeName) {
  return `Variable $${varName} of type ${typeName} ` +
    `is required and will never use the default value. ` +
    `Perhaps you meant to use type ${guessTypeName}.`;
}

export function badValueForDefaultArgMessage(varName, typeName, value) {
  return `Variable $${varName} of type ${typeName} has invalid default ` +
    `value: ${value}.`;
}

export function undefinedFieldMessage(field, type) {
  return 'Cannot query field ' + field + ' on ' + type;
}

export function fragmentOnNonCompositeErrorMessage(fragName, typeName) {
  return `Fragment "${fragName}" cannot condition on non composite ` +
    `type "${typeName}".`;
}

export function inlineFragmentOnNonCompositeErrorMessage(typeName) {
  return `Fragment cannot condition on non composite type "${typeName}".`;
}

export function unknownArgMessage(argName, fieldName, typeName) {
  return `Unknown argument ${argName} on field ${fieldName} ` +
    `of type ${typeName}.`;
}

export function unknownTypeMessage(typeName) {
  return `Unknown type ${typeName}.`;
}

export function undefinedVarMessage(varName) {
  return `Variable $${varName} is not defined.`;
}

export function undefinedVarByOpMessage(varName, opName) {
  return `Variable $${varName} is not defined by operation ${opName}.`;
}

export function unusedFragMessage(fragName) {
  return `Fragment ${fragName} is not used.`;
}

export function unusedVariableMessage(varName) {
  return `Variable $${varName} is not used.`;
}

export function typeIncompatibleSpreadMessage(fragName, parentType, fragType) {
  return `Fragment "${fragName}" cannot be spread here as objects of ` +
    `type "${parentType}" can never be of type "${fragType}".`;
}

export function typeIncompatibleAnonSpreadMessage(parentType, fragType) {
  return `Fragment cannot be spread here as objects of ` +
    `type "${parentType}" can never be of type "${fragType}".`;
}

export function noSubselectionAllowedMessage(field, type) {
  return `Field "${field}" of type ${type} must not have a sub selection.`;
}

export function requiredSubselectionMessage(field, type) {
  return `Field "${field}" of type ${type} must have a sub selection.`;
}

export function nonInputTypeOnVarMessage(variableName, typeName) {
  return `Variable $${variableName} cannot be non ` +
    `input type ${typeName}.`;
}

export function cycleErrorMessage(fragmentName, spreadNames) {
  return `Cannot spread fragment ${fragmentName} within itself` +
  (spreadNames.length ? ` via ${spreadNames.join(', ')}.` : '.');
}

export function unknownDirectiveMessage(directiveName) {
  return `Unknown directive ${directiveName}.`;
}

export function misplacedDirectiveMessage(directiveName, placement) {
  return `Directive ${directiveName} may not be used on ${placement}.`;
}

export function missingDirectiveValueMessage(directiveName, typeName) {
  return `Directive ${directiveName} expects a value of type ${typeName}.`;
}

export function noDirectiveValueMessage(directiveName) {
  return `Directive ${directiveName} expects no value.`;
}

export function badDirectiveValueMessage(directiveName, typeName, value) {
  return `Directive ${directiveName} expected type ${typeName} but ` +
    `got: ${value}.`;
}

export function badVarPosMessage(varName, varType, expectedType) {
  return `Variable $${varName} of type ${varType} used in position expecting ` +
    `type ${expectedType}.`;
}

export function fieldsConflictMessage(responseName, reason) {
  return `Fields ${responseName} conflict because ${reasonMessage(reason)}.`;
}

function reasonMessage(reason) {
  if (Array.isArray(reason)) {
    return reason.map(([responseName, subreason]) =>
      `subfields ${responseName} conflict because ${reasonMessage(subreason)}`
    ).join(' and ');
  }
  return reason;
}
