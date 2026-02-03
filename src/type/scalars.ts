import { inspect } from '../jsutils/inspect.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';

import { GraphQLError } from '../error/GraphQLError.js';

import { Kind } from '../language/kinds.js';
import { print } from '../language/printer.js';

import { defaultScalarValueToLiteral } from '../utilities/valueToLiteral.js';

import type { GraphQLNamedType } from './definition.js';
import { GraphQLScalarType } from './definition.js';

/**
 * Maximum possible Int value as per GraphQL Spec (32-bit signed integer).
 * n.b. This differs from JavaScript's numbers that are IEEE 754 doubles safe up-to 2^53 - 1
 * */
export const GRAPHQL_MAX_INT = 2147483647;

/**
 * Minimum possible Int value as per GraphQL Spec (32-bit signed integer).
 * n.b. This differs from JavaScript's numbers that are IEEE 754 doubles safe starting at -(2^53 - 1)
 * */
export const GRAPHQL_MIN_INT = -2147483648;

export const GraphQLInt = new GraphQLScalarType<number>({
  name: 'Int',
  description:
    'The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.',

  coerceOutputValue(outputValue) {
    const coercedValue = coerceOutputValueObject(outputValue);

    if (typeof coercedValue === 'number') {
      return coerceIntFromNumber(coercedValue);
    }
    if (typeof coercedValue === 'boolean') {
      return coercedValue ? 1 : 0;
    }
    if (typeof coercedValue === 'string') {
      return coerceIntFromString(coercedValue);
    }
    if (typeof coercedValue === 'bigint') {
      return coerceIntFromBigInt(coercedValue);
    }
    throw new GraphQLError(
      `Int cannot represent non-integer value: ${inspect(coercedValue)}`,
    );
  },

  coerceInputValue(inputValue) {
    if (typeof inputValue === 'number') {
      return coerceIntFromNumber(inputValue);
    }
    if (typeof inputValue === 'bigint') {
      return coerceIntFromBigInt(inputValue);
    }
    throw new GraphQLError(
      `Int cannot represent non-integer value: ${inspect(inputValue)}`,
    );
  },

  coerceInputLiteral(valueNode) {
    if (valueNode.kind !== Kind.INT) {
      throw new GraphQLError(
        `Int cannot represent non-integer value: ${print(valueNode)}`,
        { nodes: valueNode },
      );
    }
    const num = parseInt(valueNode.value, 10);
    if (num > GRAPHQL_MAX_INT || num < GRAPHQL_MIN_INT) {
      throw new GraphQLError(
        `Int cannot represent non 32-bit signed integer value: ${valueNode.value}`,
        { nodes: valueNode },
      );
    }
    return num;
  },
  valueToLiteral(value) {
    if (
      ((typeof value === 'number' && Number.isInteger(value)) ||
        typeof value === 'bigint') &&
      value <= GRAPHQL_MAX_INT &&
      value >= GRAPHQL_MIN_INT
    ) {
      return { kind: Kind.INT, value: String(value) };
    }
  },
});

export const GraphQLFloat = new GraphQLScalarType<number>({
  name: 'Float',
  description:
    'The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).',

  coerceOutputValue(outputValue) {
    const coercedValue = coerceOutputValueObject(outputValue);

    if (typeof coercedValue === 'number') {
      return coerceFloatFromNumber(coercedValue);
    }
    if (typeof coercedValue === 'boolean') {
      return coercedValue ? 1 : 0;
    }
    if (typeof coercedValue === 'string') {
      return coerceFloatFromString(coercedValue);
    }
    if (typeof coercedValue === 'bigint') {
      return coerceFloatFromBigInt(coercedValue);
    }
    throw new GraphQLError(
      `Float cannot represent non numeric value: ${inspect(coercedValue)}`,
    );
  },

  coerceInputValue(inputValue) {
    if (typeof inputValue === 'number') {
      return coerceFloatFromNumber(inputValue);
    }
    if (typeof inputValue === 'bigint') {
      return coerceFloatFromBigInt(inputValue);
    }
    throw new GraphQLError(
      `Float cannot represent non numeric value: ${inspect(inputValue)}`,
    );
  },

  coerceInputLiteral(valueNode) {
    if (valueNode.kind !== Kind.FLOAT && valueNode.kind !== Kind.INT) {
      throw new GraphQLError(
        `Float cannot represent non numeric value: ${print(valueNode)}`,
        { nodes: valueNode },
      );
    }
    return parseFloat(valueNode.value);
  },
  valueToLiteral(value) {
    const literal = defaultScalarValueToLiteral(value);
    if (literal.kind === Kind.FLOAT || literal.kind === Kind.INT) {
      return literal;
    }
  },
});

export const GraphQLString = new GraphQLScalarType<string>({
  name: 'String',
  description:
    'The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.',

  coerceOutputValue(outputValue) {
    const coercedValue = coerceOutputValueObject(outputValue);

    // Coerces string, boolean and number values to a string, but do not
    // attempt to coerce object, function, symbol, or other types as strings.
    if (typeof coercedValue === 'string') {
      return coercedValue;
    }
    if (typeof coercedValue === 'boolean') {
      return coercedValue ? 'true' : 'false';
    }
    if (typeof coercedValue === 'number') {
      return coerceStringFromNumber(coercedValue);
    }
    if (typeof coercedValue === 'bigint') {
      return String(coercedValue);
    }
    throw new GraphQLError(
      `String cannot represent value: ${inspect(outputValue)}`,
    );
  },

  coerceInputValue(inputValue) {
    if (typeof inputValue !== 'string') {
      throw new GraphQLError(
        `String cannot represent a non string value: ${inspect(inputValue)}`,
      );
    }
    return inputValue;
  },

  coerceInputLiteral(valueNode) {
    if (valueNode.kind !== Kind.STRING) {
      throw new GraphQLError(
        `String cannot represent a non string value: ${print(valueNode)}`,
        { nodes: valueNode },
      );
    }
    return valueNode.value;
  },
  valueToLiteral(value) {
    const literal = defaultScalarValueToLiteral(value);
    if (literal.kind === Kind.STRING) {
      return literal;
    }
  },
});

export const GraphQLBoolean = new GraphQLScalarType<boolean>({
  name: 'Boolean',
  description: 'The `Boolean` scalar type represents `true` or `false`.',

  coerceOutputValue(outputValue) {
    const coercedValue = coerceOutputValueObject(outputValue);

    if (typeof coercedValue === 'boolean') {
      return coercedValue;
    }
    if (typeof coercedValue === 'number') {
      return coerceBooleanFromNumber(coercedValue);
    }
    if (typeof coercedValue === 'bigint') {
      return coercedValue !== 0n;
    }
    throw new GraphQLError(
      `Boolean cannot represent a non boolean value: ${inspect(coercedValue)}`,
    );
  },

  coerceInputValue(inputValue) {
    if (typeof inputValue !== 'boolean') {
      throw new GraphQLError(
        `Boolean cannot represent a non boolean value: ${inspect(inputValue)}`,
      );
    }
    return inputValue;
  },

  coerceInputLiteral(valueNode) {
    if (valueNode.kind !== Kind.BOOLEAN) {
      throw new GraphQLError(
        `Boolean cannot represent a non boolean value: ${print(valueNode)}`,
        { nodes: valueNode },
      );
    }
    return valueNode.value;
  },
  valueToLiteral(value) {
    const literal = defaultScalarValueToLiteral(value);
    if (literal.kind === Kind.BOOLEAN) {
      return literal;
    }
  },
});

export const GraphQLID = new GraphQLScalarType<string>({
  name: 'ID',
  description:
    'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',

  coerceOutputValue(outputValue) {
    const coercedValue = coerceOutputValueObject(outputValue);

    if (typeof coercedValue === 'string') {
      return coercedValue;
    }
    if (typeof coercedValue === 'number') {
      return coerceIDFromNumber(coercedValue);
    }
    if (typeof coercedValue === 'bigint') {
      return String(coercedValue);
    }
    throw new GraphQLError(
      `ID cannot represent value: ${inspect(outputValue)}`,
    );
  },

  coerceInputValue(inputValue) {
    if (typeof inputValue === 'string') {
      return inputValue;
    }
    if (typeof inputValue === 'number') {
      return coerceIDFromNumber(inputValue);
    }
    if (typeof inputValue === 'bigint') {
      return String(inputValue);
    }
    throw new GraphQLError(`ID cannot represent value: ${inspect(inputValue)}`);
  },

  coerceInputLiteral(valueNode) {
    if (valueNode.kind !== Kind.STRING && valueNode.kind !== Kind.INT) {
      throw new GraphQLError(
        'ID cannot represent a non-string and non-integer value: ' +
          print(valueNode),
        { nodes: valueNode },
      );
    }
    return valueNode.value;
  },
  valueToLiteral(value) {
    // ID types can use number values and Int literals.
    if (typeof value === 'string') {
      // Will parse as an IntValue.
      return /^-?(?:0|[1-9][0-9]*)$/.test(value)
        ? { kind: Kind.INT, value }
        : { kind: Kind.STRING, value, block: false };
    }
    if (typeof value === 'number') {
      return { kind: Kind.INT, value: coerceIDFromNumber(value) };
    }
    if (typeof value === 'bigint') {
      return { kind: Kind.INT, value: String(value) };
    }
  },
});

export const specifiedScalarTypes: ReadonlyArray<GraphQLScalarType> =
  Object.freeze([
    GraphQLString,
    GraphQLInt,
    GraphQLFloat,
    GraphQLBoolean,
    GraphQLID,
  ]);

export function isSpecifiedScalarType(type: GraphQLNamedType): boolean {
  return specifiedScalarTypes.some(({ name }) => type.name === name);
}

// Support coercing objects with custom valueOf() or toJSON() functions -
// a common way to represent a complex value which can be represented as
// a string (ex: MongoDB id objects).
function coerceOutputValueObject(outputValue: unknown): unknown {
  if (isObjectLike(outputValue)) {
    if (typeof outputValue.valueOf === 'function') {
      const valueOfResult = outputValue.valueOf();
      if (!isObjectLike(valueOfResult)) {
        return valueOfResult;
      }
    }
    if (typeof outputValue.toJSON === 'function') {
      return outputValue.toJSON();
    }
  }
  return outputValue;
}

function coerceIntFromNumber(value: number): number {
  if (!Number.isInteger(value)) {
    throw new GraphQLError(
      `Int cannot represent non-integer value: ${inspect(value)}`,
    );
  }
  if (value > GRAPHQL_MAX_INT || value < GRAPHQL_MIN_INT) {
    throw new GraphQLError(
      `Int cannot represent non 32-bit signed integer value: ${inspect(value)}`,
    );
  }
  return value;
}

function coerceIntFromString(value: string): number {
  if (value === '') {
    throw new GraphQLError(
      `Int cannot represent non-integer value: ${inspect(value)}`,
    );
  }
  const num = Number(value);
  if (!Number.isInteger(num)) {
    throw new GraphQLError(
      `Int cannot represent non-integer value: ${inspect(value)}`,
    );
  }
  if (num > GRAPHQL_MAX_INT || num < GRAPHQL_MIN_INT) {
    throw new GraphQLError(
      `Int cannot represent non 32-bit signed integer value: ${inspect(value)}`,
    );
  }
  return num;
}

function coerceIntFromBigInt(value: bigint): number {
  if (value > GRAPHQL_MAX_INT || value < GRAPHQL_MIN_INT) {
    throw new GraphQLError(
      `Int cannot represent non 32-bit signed integer value: ${String(value)}`,
    );
  }
  return Number(value);
}

function coerceFloatFromNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new GraphQLError(
      `Float cannot represent non numeric value: ${inspect(value)}`,
    );
  }
  return value;
}

function coerceFloatFromString(value: string): number {
  if (value === '') {
    throw new GraphQLError(
      `Float cannot represent non numeric value: ${inspect(value)}`,
    );
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new GraphQLError(
      `Float cannot represent non numeric value: ${inspect(value)}`,
    );
  }
  return num;
}

function coerceFloatFromBigInt(coercedValue: bigint): number {
  const num = Number(coercedValue);
  if (!Number.isFinite(num)) {
    throw new GraphQLError(
      `Float cannot represent non numeric value: ${inspect(coercedValue)} (value is too large)`,
    );
  }
  if (BigInt(num) !== coercedValue) {
    throw new GraphQLError(
      `Float cannot represent non numeric value: ${inspect(coercedValue)} (value would lose precision)`,
    );
  }
  return num;
}

function coerceStringFromNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new GraphQLError(`String cannot represent value: ${inspect(value)}`);
  }
  return String(value);
}

function coerceBooleanFromNumber(value: number): boolean {
  if (!Number.isFinite(value)) {
    throw new GraphQLError(
      `Boolean cannot represent a non boolean value: ${inspect(value)}`,
    );
  }
  return value !== 0;
}

function coerceIDFromNumber(value: number): string {
  if (!Number.isInteger(value)) {
    throw new GraphQLError(`ID cannot represent value: ${inspect(value)}`);
  }
  return String(value);
}
