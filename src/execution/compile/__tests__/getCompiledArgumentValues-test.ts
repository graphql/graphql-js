import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectMatchingValues } from '../../../__testUtils__/expectMatchingValues.ts';

import { invariant } from '../../../jsutils/invariant.ts';

import type {
  FieldNode,
  OperationDefinitionNode,
} from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import type { GraphQLField } from '../../../type/definition.ts';
import {
  GraphQLInputObjectType,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import type { FragmentVariableValues } from '../../collectFields.ts';
import type { VariableValues } from '../../values.ts';
import { getArgumentValues, getVariableValues } from '../../values.ts';

import { compileArgumentValues } from '../compileArgumentValues.ts';
import {
  getCompiledArgumentValue,
  getCompiledArgumentValues,
  UNKNOWN_ARGUMENT_VALUE,
} from '../getCompiledArgumentValues.ts';

const schema = buildSchema(`
  input FlagInput {
    enabled: Boolean
  }

  input RequiredFlagInput {
    enabled: Boolean
    required: Boolean!
    strictList: [Boolean!]
    withDefault: String = "inputDefault"
  }

  input ChoiceInput @oneOf {
    flag: Boolean
    label: String
  }

  enum Flag {
    DISABLED
    ENABLED
  }

  type Query {
    field(
      required: Boolean!
      optional: String = "schemaDefault"
      count: Int = 3
      list: [Boolean]
      requiredList: [Boolean!]
      nestedRequiredList: [[Boolean!]!]
      input: FlagInput
      requiredInput: RequiredFlagInput
      inputList: [RequiredFlagInput]
      choice: ChoiceInput
      flag: Flag
      noDefault: String
    ): [String]
  }
`);

const queryType = schema.getQueryType();
invariant(queryType != null);

const maybeFieldDef = schema.getField(queryType, 'field');
invariant(maybeFieldDef != null);
const fieldDef = maybeFieldDef;

function getFieldNode(query: string): {
  fieldNode: FieldNode;
  operation: OperationDefinitionNode;
} {
  const document = parse(query);
  const operation = document.definitions[0];
  invariant(operation.kind === Kind.OPERATION_DEFINITION);
  const fieldNode = operation.selectionSet.selections[0];
  invariant(fieldNode.kind === Kind.FIELD);
  return { fieldNode, operation };
}

function getCoercedVariableValues(
  operation: OperationDefinitionNode,
  variableValues: { readonly [variable: string]: unknown },
) {
  const result = getVariableValues(
    schema,
    operation.variableDefinitions ?? [],
    variableValues,
  );
  invariant('variableValues' in result);
  return result.variableValues;
}

function compileField(fieldNode: FieldNode) {
  return compileArgumentValues(fieldDef, fieldNode, false, undefined);
}

function expectArgumentValuesMatch(
  expectedFieldDef: GraphQLField<unknown, unknown>,
  fieldNode: FieldNode,
  variableValues?: VariableValues,
) {
  return expectMatchingValues([
    () => getArgumentValues(expectedFieldDef, fieldNode, variableValues),
    () =>
      getCompiledArgumentValues(
        compileArgumentValues(expectedFieldDef, fieldNode, false, undefined),
        variableValues,
      ),
  ]);
}

describe('getCompiledArgumentValues', () => {
  it('returns a reusable constant map when all argument values are static', () => {
    const { fieldNode } = getFieldNode(`
      {
        field(
          required: true
          optional: "literal"
          count: 2
          list: [true, false]
          input: { enabled: true }
        )
      }
    `);

    const compiled = compileField(fieldNode);
    const args = getCompiledArgumentValues(compiled);

    expect(getCompiledArgumentValues(compiled)).to.equal(args);
    expect(getCompiledArgumentValue(compiled, 'optional')).to.equal('literal');
    expect(args).to.deep.equal({
      required: true,
      optional: 'literal',
      count: 2,
      list: [true, false],
      input: { enabled: true },
    });
  });

  it('coerces runtime variables, fragment variables, defaults, and compound values', () => {
    const { fieldNode, operation } = getFieldNode(`
      query ($required: Boolean!, $enabled: Boolean, $optional: String) {
        field(
          required: $required
          optional: $optional
          list: [true, $required]
          input: { enabled: $enabled }
          noDefault: $optional
        )
      }
    `);

    const variableValues = getCoercedVariableValues(operation, {
      required: false,
      enabled: true,
    });
    const compiled = compileField(fieldNode);
    const args = getCompiledArgumentValues(compiled, variableValues);

    expect(args).to.deep.equal({
      required: false,
      optional: 'schemaDefault',
      count: 3,
      list: [true, false],
      input: { enabled: true },
    });
    expect(
      getCompiledArgumentValue(compiled, 'required', variableValues),
    ).to.equal(false);
    expect(getCompiledArgumentValue(compiled, 'list', variableValues)).to.equal(
      UNKNOWN_ARGUMENT_VALUE,
    );
    expect(
      getCompiledArgumentValue(compiled, 'unknown', variableValues),
    ).to.equal(undefined);

    const fragmentVariableValues: FragmentVariableValues = {
      sources: {
        required: {
          signature: variableValues.sources.required.signature,
          value: undefined,
          fragmentVariableValues: undefined,
        },
      },
      coerced: { required: true },
    };

    expect(
      getCompiledArgumentValues(
        compileArgumentValues(
          fieldDef,
          fieldNode,
          false,
          fragmentVariableValues,
        ),
        variableValues,
      ).required,
    ).to.equal(true);
  });

  it('uses compiled builders for variable-backed compound values', () => {
    const { fieldNode, operation } = getFieldNode(`
      query ($required: Boolean!, $enabled: Boolean, $optional: String) {
        field(
          required: true
          list: [null, $optional]
          requiredList: [true]
          requiredInput: { enabled: $enabled, required: $required }
          inputList: { required: $required }
        )
      }
    `);

    const variableValues = getCoercedVariableValues(operation, {
      required: true,
      enabled: false,
    });
    const compiled = compileField(fieldNode);

    expect(getCompiledArgumentValues(compiled, variableValues)).to.deep.equal({
      required: true,
      optional: 'schemaDefault',
      count: 3,
      list: [null, null],
      requiredList: [true],
      requiredInput: {
        enabled: false,
        required: true,
        withDefault: 'inputDefault',
      },
      inputList: [
        {
          required: true,
          withDefault: 'inputDefault',
        },
      ],
    });

    expect(
      getCompiledArgumentValues(
        compiled,
        getCoercedVariableValues(operation, { required: true }),
      ).requiredInput,
    ).to.deep.equal({
      required: true,
      withDefault: 'inputDefault',
    });
  });

  it('falls back to validation errors for invalid compiled compound values', () => {
    const invalidNonNullLiteral = getFieldNode(`
      {
        field(required: null)
      }
    `);
    expect(() =>
      getCompiledArgumentValues(compileField(invalidNonNullLiteral.fieldNode)),
    ).to.throw('Argument "Query.field(required:)" has invalid value');

    const invalidNonNullInnerLiteral = getFieldNode(`
      {
        field(required: [])
      }
    `);
    expect(() =>
      getCompiledArgumentValues(
        compileField(invalidNonNullInnerLiteral.fieldNode),
      ),
    ).to.throw('Argument "Query.field(required:)" has invalid value');

    const invalidSingletonListItem = getFieldNode(`
      query ($required: Boolean!) {
        field(required: true, list: { enabled: $required })
      }
    `);
    expect(() =>
      getCompiledArgumentValues(
        compileField(invalidSingletonListItem.fieldNode),
        getCoercedVariableValues(invalidSingletonListItem.operation, {
          required: true,
        }),
      ),
    ).to.throw('Argument "Query.field(list:)" has invalid value');

    const invalidListItem = getFieldNode(`
      query ($required: Boolean!) {
        field(required: true, list: [{ enabled: $required }])
      }
    `);
    expect(() =>
      getCompiledArgumentValues(
        compileField(invalidListItem.fieldNode),
        getCoercedVariableValues(invalidListItem.operation, {
          required: true,
        }),
      ),
    ).to.throw('Argument "Query.field(list:)" has invalid value');

    const invalidInputShape = getFieldNode(`
      {
        field(required: true, requiredInput: true)
      }
    `);
    expect(() =>
      getCompiledArgumentValues(compileField(invalidInputShape.fieldNode)),
    ).to.throw('Argument "Query.field(requiredInput:)" has invalid value');

    const unknownInputField = getFieldNode(`
      query ($required: Boolean!) {
        field(required: true, requiredInput: { required: $required, extra: true })
      }
    `);
    expect(() =>
      getCompiledArgumentValues(
        compileField(unknownInputField.fieldNode),
        getCoercedVariableValues(unknownInputField.operation, {
          required: true,
        }),
      ),
    ).to.throw('Argument "Query.field(requiredInput:)" has invalid value');

    const invalidInputFieldValue = getFieldNode(`
      {
        field(required: true, input: { enabled: { nested: true } })
      }
    `);
    expect(() =>
      getCompiledArgumentValues(compileField(invalidInputFieldValue.fieldNode)),
    ).to.throw('Argument "Query.field(input:)" has invalid value');

    const missingInputField = getFieldNode(`
      {
        field(required: true, requiredInput: { enabled: true })
      }
    `);
    expect(() =>
      getCompiledArgumentValues(compileField(missingInputField.fieldNode)),
    ).to.throw('Argument "Query.field(requiredInput:)" has invalid value');

    const missingRequiredListItem = getFieldNode(`
      query ($value: Boolean) {
        field(required: true, requiredList: [$value])
      }
    `);
    const variableValues = getCoercedVariableValues(
      missingRequiredListItem.operation,
      {},
    );
    expect(() =>
      getCompiledArgumentValues(
        compileField(missingRequiredListItem.fieldNode),
        variableValues,
      ),
    ).to.throw('Argument "Query.field(requiredList:)" has invalid value');

    const invalidRuntimeInputField = getFieldNode(`
      query ($value: Boolean) {
        field(
          required: true
          requiredInput: { required: true, strictList: [$value] }
        )
      }
    `);
    expect(() =>
      getCompiledArgumentValues(
        compileField(invalidRuntimeInputField.fieldNode),
        getCoercedVariableValues(invalidRuntimeInputField.operation, {}),
      ),
    ).to.throw('Argument "Query.field(requiredInput:)" has invalid value');

    const invalidNestedRequiredList = getFieldNode(`
      query ($value: Boolean) {
        field(required: true, nestedRequiredList: [[$value]])
      }
    `);
    expect(() =>
      getCompiledArgumentValues(
        compileField(invalidNestedRequiredList.fieldNode),
        getCoercedVariableValues(invalidNestedRequiredList.operation, {}),
      ),
    ).to.throw('Argument "Query.field(nestedRequiredList:)" has invalid value');

    const invalidSingletonInputList = getFieldNode(`
      query ($value: Boolean) {
        field(required: true, inputList: { required: $value })
      }
    `);
    expect(() =>
      getCompiledArgumentValues(
        compileField(invalidSingletonInputList.fieldNode),
        getCoercedVariableValues(invalidSingletonInputList.operation, {}),
      ),
    ).to.throw('Argument "Query.field(inputList:)" has invalid value');
  });

  it('preserves oneOf input object coercion through compiled builders', () => {
    const { fieldNode, operation } = getFieldNode(`
      query ($flag: Boolean) {
        field(required: true, choice: { flag: $flag })
      }
    `);
    const compiled = compileField(fieldNode);

    expect(
      getCompiledArgumentValues(
        compiled,
        getCoercedVariableValues(operation, { flag: true }),
      ).choice,
    ).to.deep.equal({ flag: true });

    expect(() =>
      getCompiledArgumentValues(
        compiled,
        getCoercedVariableValues(operation, {}),
      ),
    ).to.throw('Argument "Query.field(choice:)" has invalid value');

    expect(() =>
      getCompiledArgumentValues(
        compiled,
        getCoercedVariableValues(operation, { flag: null }),
      ),
    ).to.throw('Argument "Query.field(choice:)" has invalid value');

    const nullChoice = getFieldNode(`
      {
        field(required: true, choice: { flag: null })
      }
    `);
    expect(() =>
      getCompiledArgumentValues(compileField(nullChoice.fieldNode)),
    ).to.throw('Argument "Query.field(choice:)" has invalid value');

    const tooManyChoices = getFieldNode(`
      {
        field(required: true, choice: { flag: true, label: "x" })
      }
    `);
    expect(() =>
      getCompiledArgumentValues(compileField(tooManyChoices.fieldNode)),
    ).to.throw('Argument "Query.field(choice:)" has invalid value');
  });

  it('throws for invalid values that validation would normally reject', () => {
    const invalid = getFieldNode(`
      {
        field(required: "bad")
      }
    `);
    const invalidField = compileField(invalid.fieldNode);

    expect(() => getCompiledArgumentValues(invalidField)).to.throw(
      'Argument "Query.field(required:)" has invalid value',
    );

    const invalidVariable = getFieldNode(`
      query ($required: Boolean) {
        field(required: $required)
      }
    `);
    const invalidVariableValues = getCoercedVariableValues(
      invalidVariable.operation,
      { required: null },
    );
    const invalidVariableField = compileField(invalidVariable.fieldNode);

    expect(
      getCompiledArgumentValue(
        invalidVariableField,
        'required',
        invalidVariableValues,
      ),
    ).to.equal(UNKNOWN_ARGUMENT_VALUE);
    expect(() =>
      getCompiledArgumentValues(invalidVariableField, invalidVariableValues),
    ).to.throw('Argument "Query.field(required:)" has invalid value');

    const missingRequiredVariable = getFieldNode(`
      query ($required: Boolean!) {
        field(required: $required)
      }
    `);
    const missingRequiredVariableField = compileField(
      missingRequiredVariable.fieldNode,
    );

    expect(
      getCompiledArgumentValue(missingRequiredVariableField, 'required'),
    ).to.equal(UNKNOWN_ARGUMENT_VALUE);

    const missing = getFieldNode(`
      {
        field
      }
    `);
    const missingField = compileField(missing.fieldNode);

    expect(getCompiledArgumentValue(missingField, 'required')).to.equal(
      UNKNOWN_ARGUMENT_VALUE,
    );
    expect(() => getCompiledArgumentValues(missingField)).to.throw(
      'Argument "Query.field(required:)" of required type "Boolean!" was not provided.',
    );
  });

  it('matches getArgumentValues for invalid schema argument defaults', () => {
    const invalidDefaultQuery = new GraphQLObjectType({
      name: 'InvalidDefaultQuery',
      fields: {
        field: {
          type: GraphQLString,
          args: {
            input: {
              type: GraphQLString,
              default: { value: 123 },
            },
          },
        },
      },
    });
    const invalidDefaultField = invalidDefaultQuery.getFields().field;

    expect(() =>
      expectArgumentValuesMatch(
        invalidDefaultField,
        getFieldNode('{ field }').fieldNode,
      ),
    ).to.throw(
      'Argument "InvalidDefaultQuery.field(input:)" has invalid default value: String cannot represent a non string value: 123',
    );

    const invalidDefaultVariable = getFieldNode(`
      query ($input: String) {
        field(input: $input)
      }
    `);

    expect(() =>
      expectArgumentValuesMatch(
        invalidDefaultField,
        invalidDefaultVariable.fieldNode,
        getCoercedVariableValues(invalidDefaultVariable.operation, {}),
      ),
    ).to.throw(
      'Argument "InvalidDefaultQuery.field(input:)" has invalid default value: String cannot represent a non string value: 123',
    );

    const invalidNestedDefaultQuery = new GraphQLObjectType({
      name: 'InvalidNestedDefaultQuery',
      fields: {
        field: {
          type: GraphQLString,
          args: {
            input: {
              type: new GraphQLInputObjectType({
                name: 'InvalidNestedDefaultInput',
                fields: {
                  nested: {
                    type: GraphQLString,
                    default: { value: 123 },
                  },
                },
              }),
              default: { value: {} },
            },
          },
        },
      },
    });

    expect(() =>
      expectArgumentValuesMatch(
        invalidNestedDefaultQuery.getFields().field,
        getFieldNode('{ field }').fieldNode,
      ),
    ).to.throw(
      'Argument "InvalidNestedDefaultQuery.field(input:)" has invalid default value: Expected value of type "String" to be valid, found: 123.',
    );
  });

  it('checks invalid defaults and missing arguments with fragment variables', () => {
    const fragmentVariableValues: FragmentVariableValues = {
      sources: Object.create(null),
      coerced: Object.create(null),
    };
    const invalidDefaultQuery = new GraphQLObjectType({
      name: 'InvalidDefaultWithFragmentQuery',
      fields: {
        field: {
          type: GraphQLString,
          args: {
            input: {
              type: GraphQLString,
              default: { value: 123 },
            },
          },
        },
      },
    });
    const invalidDefaultField = invalidDefaultQuery.getFields().field;
    const invalidDefaultFieldNode = getFieldNode('{ field }').fieldNode;

    expect(() =>
      getCompiledArgumentValues(
        compileArgumentValues(
          invalidDefaultField,
          invalidDefaultFieldNode,
          false,
          fragmentVariableValues,
        ),
      ),
    ).to.throw(
      'Argument "InvalidDefaultWithFragmentQuery.field(input:)" has invalid default value: String cannot represent a non string value: 123',
    );

    const invalidDefaultVariable = getFieldNode(`
      query ($input: String) {
        field(input: $input)
      }
    `);

    expect(() =>
      getCompiledArgumentValues(
        compileArgumentValues(
          invalidDefaultField,
          invalidDefaultVariable.fieldNode,
          false,
          fragmentVariableValues,
        ),
        getCoercedVariableValues(invalidDefaultVariable.operation, {}),
      ),
    ).to.throw(
      'Argument "InvalidDefaultWithFragmentQuery.field(input:)" has invalid default value: String cannot represent a non string value: 123',
    );

    const missing = getFieldNode('{ field }');
    expect(() =>
      getCompiledArgumentValues(
        compileArgumentValues(
          fieldDef,
          missing.fieldNode,
          false,
          fragmentVariableValues,
        ),
      ),
    ).to.throw(
      'Argument "Query.field(required:)" of required type "Boolean!" was not provided.',
    );
  });

  it('validates invalid variable arguments with fragment variables', () => {
    const fragmentVariableValues: FragmentVariableValues = {
      sources: Object.create(null),
      coerced: Object.create(null),
    };
    const invalidVariable = getFieldNode(`
      query ($required: Boolean) {
        field(required: $required)
      }
    `);

    expect(() =>
      getCompiledArgumentValues(
        compileArgumentValues(
          fieldDef,
          invalidVariable.fieldNode,
          false,
          fragmentVariableValues,
        ),
        getCoercedVariableValues(invalidVariable.operation, { required: null }),
      ),
    ).to.throw('Argument "Query.field(required:)" has invalid value');
  });

  it('captures error suggestion behavior in the compilation', () => {
    const { fieldNode } = getFieldNode(`
      {
        field(required: true, flag: ENABLE)
      }
    `);
    const compiled = compileArgumentValues(
      fieldDef,
      fieldNode,
      true,
      undefined,
    );

    let thrownError: Error | undefined;
    try {
      getCompiledArgumentValues(compiled);
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError?.message).to.contain(
      'Value "ENABLE" does not exist in "Flag" enum.',
    );
    expect(thrownError?.message).not.to.contain('Did you mean');
  });
});
