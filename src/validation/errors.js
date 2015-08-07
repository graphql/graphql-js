/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

export function missingFieldArgMessage(fieldName, argName, type) {
  return `Field "${fieldName}" argument "${argName}" of type "${type}" ` +
    `is required but not provided.`;
}

export function missingDirectiveArgMessage(directiveName, argName, type) {
  return `Directive "@${directiveName}" argument "${argName}" of type ` +
    `"${type}" is required but not provided.`;
}

export function badValueMessage(argName, type, value) {
  return `Argument "${argName}" expected type "${type}" but ` +
    `got: "${value}".`;
}

export function defaultForNonNullArgMessage(varName, type, guessType) {
  return `Variable "$${varName}" of type "${type}" is required and will not ` +
    `use the default value. Perhaps you meant to use type "${guessType}".`;
}

export function badValueForDefaultArgMessage(varName, type, value) {
  return `Variable "$${varName}" of type "${type}" has invalid default ` +
    `value: "${value}".`;
}

export function undefinedFieldMessage(fieldName, type) {
  return `Cannot query field "${fieldName}" on "${type}".`;
}

export function fragmentOnNonCompositeErrorMessage(fragName, type) {
  return `Fragment "${fragName}" cannot condition on non composite ` +
    `type "${type}".`;
}

export function inlineFragmentOnNonCompositeErrorMessage(type) {
  return `Fragment cannot condition on non composite type "${type}".`;
}

export function unknownArgMessage(argName, fieldName, type) {
  return `Unknown argument "${argName}" on field "${fieldName}" of ` +
    `type "${type}".`;
}

export function unknownDirectiveArgMessage(argName, directiveName) {
  return `Unknown argument "${argName}" on directive "@${directiveName}".`;
}

export function duplicateArgMessage(argName) {
  return `There can be only one argument named "${argName}".`;
}

export function unknownTypeMessage(type) {
  return `Unknown type "${type}".`;
}

export function undefinedVarMessage(varName) {
  return `Variable "$${varName}" is not defined.`;
}

export function undefinedVarByOpMessage(varName, opName) {
  return `Variable "$${varName}" is not defined by operation "${opName}".`;
}

export function unusedFragMessage(fragName) {
  return `Fragment "${fragName}" is not used.`;
}

export function unknownFragmentMessage(fragName) {
  return `Unknown fragment "${fragName}".`;
}

export function unusedVariableMessage(varName) {
  return `Variable "$${varName}" is not used.`;
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
  return `Field "${field}" of type "${type}" must not have a sub selection.`;
}

export function requiredSubselectionMessage(field, type) {
  return `Field "${field}" of type "${type}" must have a sub selection.`;
}

export function nonInputTypeOnVarMessage(variableName, typeName) {
  return `Variable "$${variableName}" cannot be non-input type "${typeName}".`;
}

export function cycleErrorMessage(fragName, spreadNames) {
  var via = spreadNames.length ? ' via ' + spreadNames.join(', ') : '';
  return `Cannot spread fragment "${fragName}" within itself${via}.`;
}

export function unknownDirectiveMessage(directiveName) {
  return `Unknown directive "${directiveName}".`;
}

export function misplacedDirectiveMessage(directiveName, placement) {
  return `Directive "${directiveName}" may not be used on "${placement}".`;
}

export function badVarPosMessage(varName, varType, expectedType) {
  return `Variable "$${varName}" of type "${varType}" used in position ` +
    `expecting type "${expectedType}".`;
}

export function duplicateFragmentNameMessage(fragName) {
  return `There can only be one fragment named "${fragName}".`;
}

export function duplicateOperationNameMessage(operationName) {
  return `There can only be one operation named "${operationName}".`;
}

export function anonOperationNotAloneMessage() {
  return `This anonymous operation must be the only defined operation.`;
}

export function fieldsConflictMessage(responseName, reason) {
  return `Fields "${responseName}" conflict because ${reasonMessage(reason)}.`;
}

function reasonMessage(reason) {
  if (Array.isArray(reason)) {
    return reason.map(([responseName, subreason]) =>
      `subfields "${responseName}" conflict because ${reasonMessage(subreason)}`
    ).join(' and ');
  }
  return reason;
}
