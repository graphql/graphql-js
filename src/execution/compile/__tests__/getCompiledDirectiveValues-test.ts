import { describe, it } from 'node:test';

import { expect } from 'chai';

import { invariant } from '../../../jsutils/invariant.ts';

import type {
  FieldNode,
  OperationDefinitionNode,
} from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import type { FragmentVariableValues } from '../../collectFields.ts';
import { getVariableValues } from '../../values.ts';

import {
  compileStreamDirective,
  withStreamDirectiveVariableValues,
} from '../compileStreamDirective.ts';
import { getCompiledDirectiveValues } from '../getCompiledDirectiveValues.ts';

const schema = buildSchema('type Query { field(count: Int): [String] }');

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

function getStreamDirectiveNode(fieldNode: FieldNode) {
  return fieldNode.directives?.find(
    (directiveNode) => directiveNode.name.value === 'stream',
  );
}

describe('getCompiledDirectiveValues', () => {
  it('returns undefined when there is no stream directive', () => {
    const { fieldNode } = getFieldNode('{ field }');
    const compiled = compileStreamDirective(getStreamDirectiveNode(fieldNode));

    expect(getCompiledDirectiveValues(compiled)).to.equal(undefined);
  });

  it('compiles static stream values and directive defaults', () => {
    const { fieldNode } = getFieldNode(`
      {
        field @stream(initialCount: 2, if: false, label: "items")
      }
    `);
    const staticDirective = compileStreamDirective(
      getStreamDirectiveNode(fieldNode),
    );

    expect(getCompiledDirectiveValues(staticDirective)).to.deep.equal({
      initialCount: 2,
      if: false,
      label: 'items',
    });

    const nullLabel = getFieldNode('{ field @stream(label: null) }');
    const nullLabelDirective = compileStreamDirective(
      getStreamDirectiveNode(nullLabel.fieldNode),
    );

    expect(getCompiledDirectiveValues(nullLabelDirective)).to.deep.equal({
      initialCount: 0,
      if: true,
    });

    const defaults = getFieldNode('{ field @stream }');
    const defaultDirective = compileStreamDirective(
      getStreamDirectiveNode(defaults.fieldNode),
    );

    expect(getCompiledDirectiveValues(defaultDirective)).to.deep.equal({
      initialCount: 0,
      if: true,
    });
  });

  it('does not bind variable scopes for static stream arguments', () => {
    const { fieldNode, operation } = getFieldNode(`
      query ($stream: Boolean!) {
        field @stream(initialCount: 2, if: false)
      }
    `);
    const variableValues = getCoercedVariableValues(operation, {
      stream: true,
    });
    const fragmentVariables: FragmentVariableValues = {
      sources: {
        stream: {
          signature: variableValues.sources.stream.signature,
          value: undefined,
          fragmentVariableValues: undefined,
        },
      },
      coerced: { stream: true },
    };
    const compiled = compileStreamDirective(getStreamDirectiveNode(fieldNode));

    expect(
      withStreamDirectiveVariableValues(compiled, fragmentVariables),
    ).to.equal(compiled);
    expect(withStreamDirectiveVariableValues(null, fragmentVariables)).to.equal(
      null,
    );

    const variableDirective = getFieldNode(`
      query ($stream: Boolean!) {
        field @stream(if: $stream)
      }
    `);
    const variableDirectiveCompilation = compileStreamDirective(
      getStreamDirectiveNode(variableDirective.fieldNode),
    );
    expect(
      withStreamDirectiveVariableValues(variableDirectiveCompilation),
    ).to.equal(variableDirectiveCompilation);
    expect(
      withStreamDirectiveVariableValues(
        variableDirectiveCompilation,
        undefined,
        fragmentVariables,
      ),
    ).not.to.equal(variableDirectiveCompilation);
  });

  it('reads operation variables and missing nullable variables', () => {
    const { fieldNode, operation } = getFieldNode(`
      query ($stream: Boolean!, $count: Int!, $label: String) {
        field @stream(if: $stream, initialCount: $count, label: $label)
      }
    `);
    const variableValues = getCoercedVariableValues(operation, {
      stream: false,
      count: 2,
    });
    const variableValuesWithLabel = getCoercedVariableValues(operation, {
      stream: false,
      count: 2,
      label: 'items',
    });
    const compiled = compileStreamDirective(getStreamDirectiveNode(fieldNode));

    expect(getCompiledDirectiveValues(compiled, variableValues)).to.deep.equal({
      initialCount: 2,
      if: false,
    });
    expect(
      getCompiledDirectiveValues(compiled, variableValuesWithLabel),
    ).to.deep.equal({
      initialCount: 2,
      if: false,
    });

    const missing = getFieldNode(`
      query ($stream: Boolean) {
        field @stream(if: $stream)
      }
    `);
    const missingVariableValues = getCoercedVariableValues(
      missing.operation,
      {},
    );
    const missingDirective = compileStreamDirective(
      getStreamDirectiveNode(missing.fieldNode),
    );

    expect(
      getCompiledDirectiveValues(missingDirective, missingVariableValues),
    ).to.deep.equal({
      initialCount: 0,
      if: true,
    });
    expect(getCompiledDirectiveValues(missingDirective)).to.deep.equal({
      initialCount: 0,
      if: true,
    });
  });

  it('prefers precomputed static fragment variables over runtime variables', () => {
    const { fieldNode, operation } = getFieldNode(`
      query ($stream: Boolean!, $count: Int!) {
        field @stream(if: $stream, initialCount: $count)
      }
    `);
    const variableValues = getCoercedVariableValues(operation, {
      stream: true,
      count: 2,
    });
    const runtimeFragmentVariables: FragmentVariableValues = {
      sources: {
        stream: {
          signature: variableValues.sources.stream.signature,
          value: undefined,
          fragmentVariableValues: undefined,
        },
      },
      coerced: { stream: true },
    };
    const staticFragmentVariables: FragmentVariableValues = {
      sources: {
        stream: {
          signature: variableValues.sources.stream.signature,
          value: undefined,
          fragmentVariableValues: undefined,
        },
      },
      coerced: { stream: false },
    };
    const compiled = withStreamDirectiveVariableValues(
      compileStreamDirective(getStreamDirectiveNode(fieldNode)),
      runtimeFragmentVariables,
      staticFragmentVariables,
    );

    expect(getCompiledDirectiveValues(compiled, variableValues)).to.deep.equal({
      initialCount: 2,
      if: false,
    });
  });

  it('uses runtime fragment variables when no static value is available', () => {
    const { fieldNode, operation } = getFieldNode(`
      query ($stream: Boolean!, $count: Int!) {
        field @stream(if: $stream, initialCount: $count)
      }
    `);
    const variableValues = getCoercedVariableValues(operation, {
      stream: true,
      count: 2,
    });
    const fragmentVariables: FragmentVariableValues = {
      sources: {
        stream: {
          signature: variableValues.sources.stream.signature,
          value: undefined,
          fragmentVariableValues: undefined,
        },
      },
      coerced: { stream: false },
    };
    const compiled = withStreamDirectiveVariableValues(
      compileStreamDirective(getStreamDirectiveNode(fieldNode)),
      fragmentVariables,
    );

    expect(getCompiledDirectiveValues(compiled, variableValues)).to.deep.equal({
      initialCount: 2,
      if: false,
    });
  });

  it('throws stored directive argument errors for values validation would reject', () => {
    const invalidLiteral = getFieldNode(
      '{ field @stream(initialCount: "bad") }',
    );
    const invalidLiteralDirective = compileStreamDirective(
      getStreamDirectiveNode(invalidLiteral.fieldNode),
    );

    expect(() => getCompiledDirectiveValues(invalidLiteralDirective)).to.throw(
      'Argument "@stream(initialCount:)" has invalid value',
    );

    const invalidVariableBackedLiteral = getFieldNode(`
      query ($count: Int!) {
        field @stream(initialCount: [$count])
      }
    `);
    const invalidVariableBackedDirective = compileStreamDirective(
      getStreamDirectiveNode(invalidVariableBackedLiteral.fieldNode),
    );
    const countVariableValues = getCoercedVariableValues(
      invalidVariableBackedLiteral.operation,
      { count: 1 },
    );

    expect(() =>
      getCompiledDirectiveValues(
        invalidVariableBackedDirective,
        countVariableValues,
      ),
    ).to.throw('Argument "@stream(initialCount:)" has invalid value');

    const invalidVariable = getFieldNode(`
      query ($stream: Boolean) {
        field @stream(if: $stream)
      }
    `);
    const variableValues = getCoercedVariableValues(invalidVariable.operation, {
      stream: null,
    });
    const invalidVariableDirective = compileStreamDirective(
      getStreamDirectiveNode(invalidVariable.fieldNode),
    );

    expect(() =>
      getCompiledDirectiveValues(invalidVariableDirective, variableValues),
    ).to.throw('Argument "@stream(if:)" has invalid value');
  });
});
