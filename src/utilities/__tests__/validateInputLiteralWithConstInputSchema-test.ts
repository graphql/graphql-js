import { describe, it } from 'node:test';

import { expect } from 'chai';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ValueNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { parseValue } from '../../language/parser.ts';

import type { FragmentVariableValues } from '../../execution/collectFields.ts';
import type { VariableValues } from '../../execution/values.ts';

import type { ConstInputSchema } from '../validateInputLiteralWithConstInputSchema.ts';
import {
  invalidDefaultValueMessage,
  validateInputLiteralWithConstInputSchema,
} from '../validateInputLiteralWithConstInputSchema.ts';

type FakeType = LeafType | ListType | NonNullType | InputObjectType;

interface LeafType {
  readonly kind: 'leaf';
  readonly name: string;
  readonly coerce: (
    valueNode: ValueNode,
    variables: VariableValues | undefined,
    fragmentVariableValues: FragmentVariableValues | undefined,
    hideSuggestions: boolean | undefined,
  ) => unknown;
}

interface ListType {
  readonly kind: 'list';
  readonly ofType: FakeType;
}

interface NonNullType {
  readonly kind: 'nonNull';
  readonly ofType: FakeType;
}

interface InputObjectType {
  readonly kind: 'inputObject';
  readonly name: string;
  readonly fields: ReadonlyArray<InputField>;
  readonly isOneOf?: boolean;
}

interface InputField {
  readonly name: string;
  readonly type: FakeType;
  readonly required?: boolean;
}

const IntType = leafType('Int', (valueNode) =>
  valueNode.kind === Kind.INT ? Number(valueNode.value) : undefined,
);
const StringType = leafType('String', (valueNode) =>
  valueNode.kind === Kind.STRING ? valueNode.value : undefined,
);

const fakeConstInputSchema: ConstInputSchema<
  FakeType,
  InputField,
  NonNullType,
  ListType,
  InputObjectType,
  LeafType
> = {
  getType(type) {
    const typeStr = typeToString(type);
    switch (type.kind) {
      case 'nonNull':
        return { kind: 'nonNull', type, typeStr, nullableType: type.ofType };
      case 'list':
        return { kind: 'list', type, typeStr, itemType: type.ofType };
      case 'inputObject':
        return {
          kind: 'inputObject',
          type,
          typeStr,
          fields: type.fields,
          isOneOf: type.isOneOf === true,
        };
      case 'leaf':
        return { kind: 'leaf', type, typeStr };
    }
  },
  getField(field) {
    return {
      name: field.name,
      type: field.type,
      isRequired: field.required === true,
    };
  },
  coerceLeafLiteral(
    type,
    valueNode,
    variables,
    fragmentVariables,
    hideSuggestions,
  ) {
    if (type.kind !== 'leaf') {
      throw new Error('Expected leaf type.');
    }
    return type.coerce(
      valueNode,
      variables ?? undefined,
      fragmentVariables ?? undefined,
      hideSuggestions ?? undefined,
    );
  },
};

describe('validateInputLiteralWithConstInputSchema', () => {
  it('formats invalid default value messages', () => {
    expect(
      invalidDefaultValueMessage('field arg', ['input', 0], 'Bad value.'),
    ).to.equal('field arg has invalid default value at .input[0]: Bad value.');
  });

  it('ignores variables during static validation', () => {
    expectErrors('$var', nonNullType(IntType)).to.deep.equal([]);
  });

  it('validates non-null variable runtime values', () => {
    expectErrors('$var', nonNullType(IntType), {
      variables: variableValues({}),
    }).to.deep.equal([
      {
        message:
          'Expected variable "$var" provided to type "Int!" to provide a runtime value.',
        path: [],
      },
    ]);

    expectErrors('$var', nonNullType(IntType), {
      variables: variableValues({ var: null }),
    }).to.deep.equal([
      {
        message:
          'Expected variable "$var" provided to non-null type "Int!" not to be null.',
        path: [],
      },
    ]);

    expectErrors('$var', nonNullType(IntType), {
      variables: variableValues({ var: 1 }),
    }).to.deep.equal([]);
    expectErrors('$var', IntType, {
      variables: variableValues({}),
    }).to.deep.equal([]);
  });

  it('uses fragment variable values when the fragment owns the variable', () => {
    expectErrors('$var', nonNullType(IntType), {
      variables: variableValues({ var: null }),
      fragmentVariableValues: fragmentVariableValues({ var: 1 }),
    }).to.deep.equal([]);

    expectErrors('$var', nonNullType(IntType), {
      variables: variableValues({ var: null }),
      fragmentVariableValues: fragmentVariableValues({}),
    }).to.deep.equal([
      {
        message:
          'Expected variable "$var" provided to non-null type "Int!" not to be null.',
        path: [],
      },
    ]);

    expectErrors('$var', nonNullType(IntType), {
      fragmentVariableValues: fragmentVariableValues({}),
    }).to.deep.equal([
      {
        message:
          'Expected variable "$var" provided to type "Int!" to provide a runtime value.',
        path: [],
      },
    ]);
  });

  it('validates non-null and null literals', () => {
    expectErrors('null', nonNullType(IntType)).to.deep.equal([
      {
        message: 'Expected value of non-null type "Int!" not to be null.',
        path: [],
      },
    ]);
    expectErrors('1', nonNullType(IntType)).to.deep.equal([]);
    expectErrors('null', IntType).to.deep.equal([]);
  });

  it('validates list literals and single-item list coercion', () => {
    expectErrors('[1, "bad"]', listType(IntType)).to.deep.equal([
      {
        message: 'Expected value of type "Int", found: "bad".',
        path: [1],
      },
    ]);
    expectErrors('"bad"', listType(IntType)).to.deep.equal([
      {
        message: 'Expected value of type "Int", found: "bad".',
        path: [],
      },
    ]);
  });

  it('validates input object shape and nested fields', () => {
    const inputType = inputObjectType('Input', [
      { name: 'requiredInt', type: IntType, required: true },
      { name: 'optionalString', type: StringType },
    ]);

    expectErrors('1', inputType).to.deep.equal([
      {
        message: 'Expected value of type "Input" to be an object, found: 1.',
        path: [],
      },
    ]);
    expectErrors('{ optionalString: "ok" }', inputType).to.deep.equal([
      {
        message:
          'Expected value of type "Input" to include required field "requiredInt", found: { optionalString: "ok" }.',
        path: [],
      },
    ]);
    expectErrors(
      '{ requiredInt: "bad", optionalString: 2 }',
      inputType,
    ).to.deep.equal([
      {
        message: 'Expected value of type "Int", found: "bad".',
        path: ['requiredInt'],
      },
      {
        message: 'Expected value of type "String", found: 2.',
        path: ['optionalString'],
      },
    ]);
  });

  it('validates duplicate input object field definitions and values', () => {
    const inputType = inputObjectType('Input', [
      { name: 'value', type: IntType },
      { name: 'value', type: StringType },
    ]);

    expectErrors('{ value: true, value: false }', inputType).to.deep.equal([
      {
        message: 'Expected value of type "Int", found: false.',
        path: ['value'],
      },
      {
        message: 'Expected value of type "String", found: false.',
        path: ['value'],
      },
    ]);
  });

  it('validates the last duplicate input object field value', () => {
    const inputType = inputObjectType('Input', [
      { name: 'value', type: IntType },
    ]);

    expectErrors('{ value: "bad", value: false }', inputType).to.deep.equal([
      {
        message: 'Expected value of type "Int", found: false.',
        path: ['value'],
      },
    ]);
  });

  it('accepts duplicate input object field values when the last value is valid', () => {
    const inputType = inputObjectType('Input', [
      { name: 'value', type: IntType },
    ]);

    expectErrors('{ value: "bad", value: 1 }', inputType).to.deep.equal([]);
    expectErrors('{ value: 1, value: "bad" }', inputType).to.deep.equal([
      {
        message: 'Expected value of type "Int", found: "bad".',
        path: ['value'],
      },
    ]);
  });

  it('uses the last duplicate input object field value per duplicate field definition', () => {
    const inputType = inputObjectType('Input', [
      { name: 'value', type: IntType },
      { name: 'value', type: StringType },
    ]);

    expectErrors('{ value: "bad", value: false }', inputType).to.deep.equal([
      {
        message: 'Expected value of type "Int", found: false.',
        path: ['value'],
      },
      {
        message: 'Expected value of type "String", found: false.',
        path: ['value'],
      },
    ]);
  });

  it('validates unknown input object fields with and without suggestions', () => {
    const inputType = inputObjectType('Input', [
      { name: 'knownField', type: IntType },
    ]);

    expectErrors('{ KnownField: 1 }', inputType).to.deep.equal([
      {
        message:
          'Expected value of type "Input" not to include unknown field "KnownField". Did you mean "knownField"? Found: { KnownField: 1 }.',
        path: [],
      },
    ]);

    expectErrors('{ KnownField: 1 }', inputType, {
      hideSuggestions: true,
    }).to.deep.equal([
      {
        message:
          'Expected value of type "Input" not to include unknown field "KnownField", found: { KnownField: 1 }.',
        path: [],
      },
    ]);
  });

  it('validates input object values when field records are absent', () => {
    expectErrors('{ unknown: 1 }', inputObjectType('Empty', [])).to.deep.equal([
      {
        message:
          'Expected value of type "Empty" not to include unknown field "unknown", found: { unknown: 1 }.',
        path: [],
      },
    ]);

    expectErrors(
      '{ unknown: 1 }',
      inputObjectType('EmptyOneOf', [], true),
    ).to.deep.equal([
      {
        message:
          'Expected value of type "EmptyOneOf" not to include unknown field "unknown", found: { unknown: 1 }.',
        path: [],
      },
      {
        message:
          'Within OneOf Input Object type "EmptyOneOf", exactly one field must be specified, and the value for that field must be non-null.',
        path: [],
      },
    ]);
  });

  it('skips optional missing variables in input object fields', () => {
    const inputType = inputObjectType('Input', [
      { name: 'optionalInt', type: IntType },
    ]);

    expectErrors('{ optionalInt: $var }', inputType, {
      variables: variableValues({}),
    }).to.deep.equal([]);
  });

  it('validates oneOf input object fields', () => {
    const oneOfType = inputObjectType(
      'Choice',
      [{ name: 'value', type: IntType }],
      true,
    );

    expectErrors('{}', oneOfType).to.deep.equal([
      {
        message:
          'Within OneOf Input Object type "Choice", exactly one field must be specified, and the value for that field must be non-null.',
        path: [],
      },
    ]);
    expectErrors('{ value: null }', oneOfType).to.deep.equal([
      {
        message:
          'Within OneOf Input Object type "Choice", exactly one field must be specified, and the value for that field must be non-null.',
        path: ['value'],
      },
    ]);
    expectErrors('{ value: $var }', oneOfType, {
      variables: variableValues({}),
    }).to.deep.equal([
      {
        message:
          'Expected variable "$var" provided to field "value" for OneOf Input Object type "Choice" to provide a runtime value.',
        path: [],
      },
    ]);
    expectErrors('{ value: $var }', oneOfType, {
      variables: variableValues({ var: null }),
    }).to.deep.equal([
      {
        message:
          'Expected variable "$var" provided to field "value" for OneOf Input Object type "Choice" not to be null.',
        path: [],
      },
    ]);
    expectErrors('{ value: 1 }', oneOfType).to.deep.equal([]);
  });

  it('validates leaf coercion results and errors', () => {
    expectErrors(
      '1',
      leafType('NullLeaf', () => null),
    ).to.deep.equal([]);
    expectErrors(
      '1',
      leafType('BadLeaf', () => undefined),
    ).to.deep.equal([
      {
        message: 'Expected value of type "BadLeaf", found: 1.',
        path: [],
      },
    ]);
    expectErrors(
      '1',
      leafType('GraphQLErrorLeaf', () => {
        throw new GraphQLError('Custom literal error.');
      }),
    ).to.deep.equal([{ message: 'Custom literal error.', path: [] }]);
    expectErrors(
      '1',
      leafType('ErrorLeaf', () => {
        throw new Error('Some error message.');
      }),
    ).to.deep.equal([
      {
        message:
          'Expected value of type "ErrorLeaf", but encountered error "Some error message."; found: 1.',
        path: [],
      },
    ]);
    expectErrors(
      '1',
      leafType('StringThrowLeaf', () => {
        // eslint-disable-next-line no-throw-literal, @typescript-eslint/only-throw-error
        throw 'Not an error object.';
      }),
    ).to.deep.equal([
      {
        message:
          'Expected value of type "StringThrowLeaf", but encountered error "Not an error object."; found: 1.',
        path: [],
      },
    ]);
    expectErrors(
      '1',
      leafType('EmptyMessageLeaf', () => {
        // eslint-disable-next-line no-throw-literal, @typescript-eslint/only-throw-error
        throw { message: '' };
      }),
    ).to.deep.equal([
      {
        message:
          'Expected value of type "EmptyMessageLeaf", but encountered error "[object Object]"; found: 1.',
        path: [],
      },
    ]);
    expectErrors(
      '1',
      leafType('NonStringMessageLeaf', () => {
        // eslint-disable-next-line no-throw-literal, @typescript-eslint/only-throw-error
        throw { message: 123 };
      }),
    ).to.deep.equal([
      {
        message:
          'Expected value of type "NonStringMessageLeaf", but encountered error "[object Object]"; found: 1.',
        path: [],
      },
    ]);
  });

  it('passes runtime values and hidden-suggestion state to leaf coercion', () => {
    const variables = variableValues({ var: 1 });
    const fragmentVariables = fragmentVariableValues({ fragmentVar: 2 });
    const captureType = leafType(
      'Capture',
      (_valueNode, receivedVariables, receivedFragmentVariables, hide) => {
        expect(receivedVariables).to.equal(variables);
        expect(receivedFragmentVariables).to.equal(fragmentVariables);
        expect(hide).to.equal(true);
        return 'ok';
      },
    );

    expectErrors('"value"', captureType, {
      variables,
      fragmentVariableValues: fragmentVariables,
      hideSuggestions: true,
    }).to.deep.equal([]);
  });
});

function expectErrors(
  inputValue: string,
  type: FakeType,
  options?: {
    readonly variables?: VariableValues;
    readonly fragmentVariableValues?: FragmentVariableValues;
    readonly hideSuggestions?: boolean;
  },
): ReturnType<typeof expect> {
  const errors: Array<{
    message: string;
    path: ReadonlyArray<string | number>;
  }> = [];
  validateInputLiteralWithConstInputSchema(
    parseValue(inputValue),
    type,
    fakeConstInputSchema,
    (error, path) => {
      errors.push({ message: error.message, path });
    },
    options?.variables,
    options?.fragmentVariableValues,
    options?.hideSuggestions,
  );
  return expect(errors);
}

function leafType(name: string, coerce: LeafType['coerce']): LeafType {
  return { kind: 'leaf', name, coerce };
}

function listType(ofType: FakeType): ListType {
  return { kind: 'list', ofType };
}

function nonNullType(ofType: FakeType): NonNullType {
  return { kind: 'nonNull', ofType };
}

function inputObjectType(
  name: string,
  fields: ReadonlyArray<InputField>,
  isOneOf?: boolean,
): InputObjectType {
  return isOneOf === undefined
    ? { kind: 'inputObject', name, fields }
    : { kind: 'inputObject', name, fields, isOneOf };
}

function typeToString(type: FakeType): string {
  switch (type.kind) {
    case 'leaf':
      return type.name;
    case 'list':
      return `[${typeToString(type.ofType)}]`;
    case 'nonNull':
      return `${typeToString(type.ofType)}!`;
    case 'inputObject':
      return type.name;
  }
}

function variableValues(
  coerced: Readonly<{ [key: string]: unknown }>,
): VariableValues {
  const sources: { [key: string]: object } = Object.create(null);
  for (const variableName of Object.keys(coerced)) {
    sources[variableName] = {};
  }
  return { sources, coerced } as unknown as VariableValues;
}

function fragmentVariableValues(
  coerced: Readonly<{ [key: string]: unknown }>,
): FragmentVariableValues {
  const sources: { [key: string]: object } = Object.create(null);
  for (const variableName of Object.keys(coerced)) {
    sources[variableName] = {};
  }
  return { sources, coerced } as unknown as FragmentVariableValues;
}
