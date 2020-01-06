import isFinite from '../polyfills/isFinite';
import isInteger from '../polyfills/isInteger';
import inspect from '../jsutils/inspect';
import isObjectLike from '../jsutils/isObjectLike';
import { Kind } from '../language/kinds';
import { print } from '../language/printer';
import { GraphQLError } from '../error/GraphQLError';
import { GraphQLScalarType } from './definition'; // As per the GraphQL Spec, Integers are only treated as valid when a valid
// 32-bit signed integer, providing the broadest support across platforms.
//
// n.b. JavaScript's integers are safe between -(2^53 - 1) and 2^53 - 1 because
// they are internally represented as IEEE 754 doubles.

var MAX_INT = 2147483647;
var MIN_INT = -2147483648;

function serializeInt(outputValue) {
  if (typeof outputValue === 'boolean') {
    return outputValue ? 1 : 0;
  }

  var num = outputValue;

  if (typeof outputValue === 'string' && outputValue !== '') {
    num = Number(outputValue);
  }

  if (!isInteger(num)) {
    throw new GraphQLError("Int cannot represent non-integer value: ".concat(inspect(outputValue)));
  }

  if (num > MAX_INT || num < MIN_INT) {
    throw new GraphQLError('Int cannot represent non 32-bit signed integer value: ' + inspect(outputValue));
  }

  return num;
}

function coerceInt(inputValue) {
  if (!isInteger(inputValue)) {
    throw new GraphQLError("Int cannot represent non-integer value: ".concat(inspect(inputValue)));
  }

  if (inputValue > MAX_INT || inputValue < MIN_INT) {
    throw new GraphQLError("Int cannot represent non 32-bit signed integer value: ".concat(inputValue));
  }

  return inputValue;
}

export var GraphQLInt = new GraphQLScalarType({
  name: 'Int',
  description: 'The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.',
  serialize: serializeInt,
  parseValue: coerceInt,
  parseLiteral: function parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.INT) {
      throw new GraphQLError("Int cannot represent non-integer value: ".concat(print(valueNode)), valueNode);
    }

    var num = parseInt(valueNode.value, 10);

    if (num > MAX_INT || num < MIN_INT) {
      throw new GraphQLError("Int cannot represent non 32-bit signed integer value: ".concat(valueNode.value), valueNode);
    }

    return num;
  }
});

function serializeFloat(outputValue) {
  if (typeof outputValue === 'boolean') {
    return outputValue ? 1 : 0;
  }

  var num = outputValue;

  if (typeof outputValue === 'string' && outputValue !== '') {
    num = Number(outputValue);
  }

  if (!isFinite(num)) {
    throw new GraphQLError("Float cannot represent non numeric value: ".concat(inspect(outputValue)));
  }

  return num;
}

function coerceFloat(inputValue) {
  if (!isFinite(inputValue)) {
    throw new GraphQLError("Float cannot represent non numeric value: ".concat(inspect(inputValue)));
  }

  return inputValue;
}

export var GraphQLFloat = new GraphQLScalarType({
  name: 'Float',
  description: 'The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).',
  serialize: serializeFloat,
  parseValue: coerceFloat,
  parseLiteral: function parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.FLOAT && valueNode.kind !== Kind.INT) {
      throw new GraphQLError("Float cannot represent non numeric value: ".concat(print(valueNode)), valueNode);
    }

    return parseFloat(valueNode.value);
  }
}); // Support serializing objects with custom valueOf() or toJSON() functions -
// a common way to represent a complex value which can be represented as
// a string (ex: MongoDB id objects).

function serializeObject(outputValue) {
  if (isObjectLike(outputValue)) {
    if (typeof outputValue.valueOf === 'function') {
      var valueOfResult = outputValue.valueOf();

      if (!isObjectLike(valueOfResult)) {
        return valueOfResult;
      }
    }

    if (typeof outputValue.toJSON === 'function') {
      // $FlowFixMe(>=0.90.0)
      return outputValue.toJSON();
    }
  }

  return outputValue;
}

function serializeString(outputValue) {
  var coercedValue = serializeObject(outputValue); // Serialize string, boolean and number values to a string, but do not
  // attempt to coerce object, function, symbol, or other types as strings.

  if (typeof coercedValue === 'string') {
    return coercedValue;
  }

  if (typeof coercedValue === 'boolean') {
    return coercedValue ? 'true' : 'false';
  }

  if (isFinite(coercedValue)) {
    return coercedValue.toString();
  }

  throw new GraphQLError("String cannot represent value: ".concat(inspect(outputValue)));
}

function coerceString(inputValue) {
  if (typeof inputValue !== 'string') {
    throw new GraphQLError("String cannot represent a non string value: ".concat(inspect(inputValue)));
  }

  return inputValue;
}

export var GraphQLString = new GraphQLScalarType({
  name: 'String',
  description: 'The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.',
  serialize: serializeString,
  parseValue: coerceString,
  parseLiteral: function parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.STRING) {
      throw new GraphQLError("String cannot represent a non string value: ".concat(print(valueNode)), valueNode);
    }

    return valueNode.value;
  }
});

function serializeBoolean(outputValue) {
  if (typeof outputValue === 'boolean') {
    return outputValue;
  }

  if (isFinite(outputValue)) {
    return outputValue !== 0;
  }

  throw new GraphQLError("Boolean cannot represent a non boolean value: ".concat(inspect(outputValue)));
}

function coerceBoolean(inputValue) {
  if (typeof inputValue !== 'boolean') {
    throw new GraphQLError("Boolean cannot represent a non boolean value: ".concat(inspect(inputValue)));
  }

  return inputValue;
}

export var GraphQLBoolean = new GraphQLScalarType({
  name: 'Boolean',
  description: 'The `Boolean` scalar type represents `true` or `false`.',
  serialize: serializeBoolean,
  parseValue: coerceBoolean,
  parseLiteral: function parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.BOOLEAN) {
      throw new GraphQLError("Boolean cannot represent a non boolean value: ".concat(print(valueNode)), valueNode);
    }

    return valueNode.value;
  }
});

function serializeID(outputValue) {
  var coercedValue = serializeObject(outputValue);

  if (typeof coercedValue === 'string') {
    return coercedValue;
  }

  if (isInteger(coercedValue)) {
    return String(coercedValue);
  }

  throw new GraphQLError("ID cannot represent value: ".concat(inspect(outputValue)));
}

function coerceID(inputValue) {
  if (typeof inputValue === 'string') {
    return inputValue;
  }

  if (isInteger(inputValue)) {
    return inputValue.toString();
  }

  throw new GraphQLError("ID cannot represent value: ".concat(inspect(inputValue)));
}

export var GraphQLID = new GraphQLScalarType({
  name: 'ID',
  description: 'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',
  serialize: serializeID,
  parseValue: coerceID,
  parseLiteral: function parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.STRING && valueNode.kind !== Kind.INT) {
      throw new GraphQLError('ID cannot represent a non-string and non-integer value: ' + print(valueNode), valueNode);
    }

    return valueNode.value;
  }
});
export var specifiedScalarTypes = Object.freeze([GraphQLString, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLID]);
export function isSpecifiedScalarType(type) {
  return specifiedScalarTypes.some(function (_ref) {
    var name = _ref.name;
    return type.name === name;
  });
}
