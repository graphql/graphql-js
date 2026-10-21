import { describe, it } from 'node:test';

import { expect } from 'chai';

import { invariant } from '../../../jsutils/invariant.ts';

import type {
  DirectiveNode,
  OperationDefinitionNode,
} from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLNonNull } from '../../../type/definition.ts';
import { GraphQLBoolean } from '../../../type/scalars.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import type { FragmentVariableValues } from '../../collectFields.ts';
import type { GraphQLVariableSignature } from '../../getVariableSignature.ts';
import { getVariableValues } from '../../values.ts';

import type { CompiledDirectiveArgument } from '../compileBooleanDirective.ts';
import { compileBooleanDirective } from '../compileBooleanDirective.ts';
import { getCompiledDirectiveIfValue } from '../getCompiledDirectiveIfValue.ts';

const schema = buildSchema('type Query { field: String }');
const BOOLEAN_NON_NULL = new GraphQLNonNull(GraphQLBoolean);
const TEST_IF_ARGUMENT: CompiledDirectiveArgument = {
  coordinate: '@test(if:)',
  type: BOOLEAN_NON_NULL,
  defaultValue: undefined,
};
const TEST_IF_ARGUMENT_WITH_DEFAULT: CompiledDirectiveArgument = {
  coordinate: '@test(if:)',
  type: GraphQLBoolean,
  defaultValue: true,
};
const booleanSignature: GraphQLVariableSignature = {
  name: 'show',
  type: GraphQLBoolean,
  default: undefined,
};

function getDirectiveNode(query: string): {
  directiveNode: DirectiveNode | undefined;
  operation: OperationDefinitionNode;
} {
  const document = parse(query);
  const operation = document.definitions[0];
  invariant(operation.kind === Kind.OPERATION_DEFINITION);
  const fieldNode = operation.selectionSet.selections[0];
  invariant(fieldNode.kind === Kind.FIELD);
  return {
    directiveNode: fieldNode.directives?.find(
      (directive) => directive.name.value === 'test',
    ),
    operation,
  };
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

function getFragmentVariableValues(value: unknown): FragmentVariableValues {
  return {
    sources: {
      show: {
        signature: booleanSignature,
        value: undefined,
        fragmentVariableValues: undefined,
      },
    },
    coerced: { show: value },
  };
}

describe('getCompiledDirectiveIfValue', () => {
  it('returns undefined when there is no directive', () => {
    const { directiveNode, operation } = getDirectiveNode('{ field }');
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, {}),
        undefined,
        false,
      ),
    ).to.equal(undefined);
  });

  it('compiles static boolean values', () => {
    const { directiveNode, operation } = getDirectiveNode(
      '{ field @test(if: false) }',
    );
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, {}),
        undefined,
        false,
      ),
    ).to.equal(false);
  });

  it('reads runtime operation variables', () => {
    const { directiveNode, operation } = getDirectiveNode(
      'query ($show: Boolean!) { field @test(if: $show) }',
    );
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, { show: true }),
        undefined,
        false,
      ),
    ).to.equal(true);
  });

  it('uses directive argument defaults for missing runtime variables', () => {
    const { directiveNode, operation } = getDirectiveNode(
      '{ field @test(if: $show) }',
    );
    const compiled = compileBooleanDirective(
      directiveNode,
      TEST_IF_ARGUMENT_WITH_DEFAULT,
    );

    expect(
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, {}),
        undefined,
        false,
      ),
    ).to.equal(true);
  });

  it('throws for invalid runtime operation variables', () => {
    const { directiveNode, operation } = getDirectiveNode(
      'query ($show: Boolean) { field @test(if: $show) }',
    );
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(() =>
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, { show: null }),
        undefined,
        false,
      ),
    ).to.throw('Argument "@test(if:)" has invalid value');
  });

  it('reads static fragment variables before runtime variables', () => {
    const { directiveNode, operation } = getDirectiveNode(
      'query ($show: Boolean!) { field @test(if: $show) }',
    );
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, { show: true }),
        {
          runtime: undefined,
          static: getFragmentVariableValues(false),
        },
        false,
      ),
    ).to.equal(false);
  });

  it('reads runtime fragment variables before operation variables', () => {
    const { directiveNode, operation } = getDirectiveNode(
      'query ($show: Boolean!) { field @test(if: $show) }',
    );
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, { show: false }),
        {
          runtime: getFragmentVariableValues(true),
          static: undefined,
        },
        false,
      ),
    ).to.equal(true);
  });

  it('uses operation variables when fragment variables do not bind the variable', () => {
    const { directiveNode, operation } = getDirectiveNode(
      'query ($show: Boolean!) { field @test(if: $show) }',
    );
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, { show: true }),
        {
          runtime: {
            sources: Object.create(null),
            coerced: Object.create(null),
          },
          static: undefined,
        },
        false,
      ),
    ).to.equal(true);
  });

  it('throws for a missing required if argument', () => {
    const { directiveNode, operation } = getDirectiveNode('{ field @test }');
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(() =>
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, {}),
        undefined,
        false,
      ),
    ).to.throw(
      'Argument "@test(if:)" of required type "Boolean!" was not provided.',
    );
  });

  it('throws for invalid literal values', () => {
    const { directiveNode, operation } = getDirectiveNode(
      '{ field @test(if: null) }',
    );
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(() =>
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, {}),
        undefined,
        false,
      ),
    ).to.throw('Argument "@test(if:)" has invalid value');
  });

  it('throws for invalid literal values with fragment variables', () => {
    const { directiveNode, operation } = getDirectiveNode(
      '{ field @test(if: null) }',
    );
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(() =>
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, {}),
        {
          runtime: getFragmentVariableValues(true),
          static: undefined,
        },
        false,
      ),
    ).to.throw('Argument "@test(if:)" has invalid value');
  });

  it('throws for invalid static fragment variable values', () => {
    const { directiveNode, operation } = getDirectiveNode(
      'query ($show: Boolean!) { field @test(if: $show) }',
    );
    const compiled = compileBooleanDirective(directiveNode, TEST_IF_ARGUMENT);

    expect(() =>
      getCompiledDirectiveIfValue(
        compiled,
        getCoercedVariableValues(operation, { show: true }),
        {
          runtime: undefined,
          static: getFragmentVariableValues(null),
        },
        false,
      ),
    ).to.throw('Argument "@test(if:)" has invalid value');
  });
});
