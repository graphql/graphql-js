'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.coerceInputValue = void 0;
const didYouMean_js_1 = require('../jsutils/didYouMean.js');
const inspect_js_1 = require('../jsutils/inspect.js');
const invariant_js_1 = require('../jsutils/invariant.js');
const isIterableObject_js_1 = require('../jsutils/isIterableObject.js');
const isObjectLike_js_1 = require('../jsutils/isObjectLike.js');
const Path_js_1 = require('../jsutils/Path.js');
const printPathArray_js_1 = require('../jsutils/printPathArray.js');
const suggestionList_js_1 = require('../jsutils/suggestionList.js');
const GraphQLError_js_1 = require('../error/GraphQLError.js');
const definition_js_1 = require('../type/definition.js');
/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 */
function coerceInputValue(inputValue, type, onError = defaultOnError) {
  return coerceInputValueImpl(inputValue, type, onError, undefined);
}
exports.coerceInputValue = coerceInputValue;
function defaultOnError(path, invalidValue, error) {
  let errorPrefix = 'Invalid value ' + (0, inspect_js_1.inspect)(invalidValue);
  if (path.length > 0) {
    errorPrefix += ` at "value${(0, printPathArray_js_1.printPathArray)(
      path,
    )}"`;
  }
  error.message = errorPrefix + ': ' + error.message;
  throw error;
}
function coerceInputValueImpl(inputValue, type, onError, path) {
  if ((0, definition_js_1.isNonNullType)(type)) {
    if (inputValue != null) {
      return coerceInputValueImpl(inputValue, type.ofType, onError, path);
    }
    onError(
      (0, Path_js_1.pathToArray)(path),
      inputValue,
      new GraphQLError_js_1.GraphQLError(
        `Expected non-nullable type "${(0, inspect_js_1.inspect)(
          type,
        )}" not to be null.`,
      ),
    );
    return;
  }
  if (inputValue == null) {
    // Explicitly return the value null.
    return null;
  }
  if ((0, definition_js_1.isListType)(type)) {
    const itemType = type.ofType;
    if ((0, isIterableObject_js_1.isIterableObject)(inputValue)) {
      return Array.from(inputValue, (itemValue, index) => {
        const itemPath = (0, Path_js_1.addPath)(path, index, undefined);
        return coerceInputValueImpl(itemValue, itemType, onError, itemPath);
      });
    }
    // Lists accept a non-list value as a list of one.
    return [coerceInputValueImpl(inputValue, itemType, onError, path)];
  }
  if ((0, definition_js_1.isInputObjectType)(type)) {
    if (!(0, isObjectLike_js_1.isObjectLike)(inputValue)) {
      onError(
        (0, Path_js_1.pathToArray)(path),
        inputValue,
        new GraphQLError_js_1.GraphQLError(
          `Expected type "${type.name}" to be an object.`,
        ),
      );
      return;
    }
    const coercedValue = {};
    const fieldDefs = type.getFields();
    for (const field of Object.values(fieldDefs)) {
      const fieldValue = inputValue[field.name];
      if (fieldValue === undefined) {
        if (field.defaultValue !== undefined) {
          coercedValue[field.name] = field.defaultValue;
        } else if ((0, definition_js_1.isNonNullType)(field.type)) {
          const typeStr = (0, inspect_js_1.inspect)(field.type);
          onError(
            (0, Path_js_1.pathToArray)(path),
            inputValue,
            new GraphQLError_js_1.GraphQLError(
              `Field "${field.name}" of required type "${typeStr}" was not provided.`,
            ),
          );
        }
        continue;
      }
      coercedValue[field.name] = coerceInputValueImpl(
        fieldValue,
        field.type,
        onError,
        (0, Path_js_1.addPath)(path, field.name, type.name),
      );
    }
    // Ensure every provided field is defined.
    for (const fieldName of Object.keys(inputValue)) {
      if (fieldDefs[fieldName] == null) {
        const suggestions = (0, suggestionList_js_1.suggestionList)(
          fieldName,
          Object.keys(type.getFields()),
        );
        onError(
          (0, Path_js_1.pathToArray)(path),
          inputValue,
          new GraphQLError_js_1.GraphQLError(
            `Field "${fieldName}" is not defined by type "${type.name}".` +
              (0, didYouMean_js_1.didYouMean)(suggestions),
          ),
        );
      }
    }
    if (type.isOneOf) {
      const keys = Object.keys(coercedValue);
      if (keys.length !== 1) {
        onError(
          (0, Path_js_1.pathToArray)(path),
          inputValue,
          new GraphQLError_js_1.GraphQLError(
            `Exactly one key must be specified for OneOf type "${type.name}".`,
          ),
        );
      }
      const key = keys[0];
      const value = coercedValue[key];
      if (value === null) {
        onError(
          (0, Path_js_1.pathToArray)(path).concat(key),
          value,
          new GraphQLError_js_1.GraphQLError(
            `Field "${key}" must be non-null.`,
          ),
        );
      }
    }
    return coercedValue;
  }
  if ((0, definition_js_1.isLeafType)(type)) {
    let parseResult;
    // Scalars and Enums determine if an input value is valid via parseValue(),
    // which can throw to indicate failure. If it throws, maintain a reference
    // to the original error.
    try {
      parseResult = type.parseValue(inputValue);
    } catch (error) {
      if (error instanceof GraphQLError_js_1.GraphQLError) {
        onError((0, Path_js_1.pathToArray)(path), inputValue, error);
      } else {
        onError(
          (0, Path_js_1.pathToArray)(path),
          inputValue,
          new GraphQLError_js_1.GraphQLError(
            `Expected type "${type.name}". ` + error.message,
            {
              originalError: error,
            },
          ),
        );
      }
      return;
    }
    if (parseResult === undefined) {
      onError(
        (0, Path_js_1.pathToArray)(path),
        inputValue,
        new GraphQLError_js_1.GraphQLError(`Expected type "${type.name}".`),
      );
    }
    return parseResult;
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.
  false ||
    (0, invariant_js_1.invariant)(
      false,
      'Unexpected input type: ' + (0, inspect_js_1.inspect)(type),
    );
}
