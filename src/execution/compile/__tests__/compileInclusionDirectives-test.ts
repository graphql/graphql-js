import { describe, it } from 'node:test';

import { expect } from 'chai';

import { invariant } from '../../../jsutils/invariant.ts';

import type {
  DirectiveNode,
  OperationDefinitionNode,
} from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { getVariableValues } from '../../values.ts';

import {
  compileIncludeDirective,
  compileSkipDirective,
  shouldIncludeSelection,
} from '../compileInclusionDirectives.ts';

const schema = buildSchema('type Query { field: String }');

function getDirectiveNodes(query: string): {
  skipDirectiveNode: DirectiveNode | undefined;
  includeDirectiveNode: DirectiveNode | undefined;
  operation: OperationDefinitionNode;
} {
  const document = parse(query);
  const operation = document.definitions[0];
  invariant(operation.kind === Kind.OPERATION_DEFINITION);
  const fieldNode = operation.selectionSet.selections[0];
  invariant(fieldNode.kind === Kind.FIELD);

  return {
    skipDirectiveNode: fieldNode.directives?.find(
      (directive) => directive.name.value === 'skip',
    ),
    includeDirectiveNode: fieldNode.directives?.find(
      (directive) => directive.name.value === 'include',
    ),
    operation,
  };
}

function getCoercedVariableValues(
  operation: OperationDefinitionNode,
  variableValues: { readonly [variable: string]: unknown } = {},
) {
  const result = getVariableValues(
    schema,
    operation.variableDefinitions ?? [],
    variableValues,
  );
  invariant('variableValues' in result);
  return result.variableValues;
}

describe('compileInclusionDirectives', () => {
  it('includes selections without inclusion directives', () => {
    const { skipDirectiveNode, includeDirectiveNode, operation } =
      getDirectiveNodes('{ field }');

    expect(
      shouldIncludeSelection(
        {
          skipDirective: compileSkipDirective(skipDirectiveNode),
          includeDirective: compileIncludeDirective(includeDirectiveNode),
        },
        getCoercedVariableValues(operation),
        undefined,
        false,
      ),
    ).to.equal(true);
  });

  it('skips selections when @skip is true', () => {
    const { skipDirectiveNode, includeDirectiveNode, operation } =
      getDirectiveNodes('{ field @skip(if: true) }');

    expect(
      shouldIncludeSelection(
        {
          skipDirective: compileSkipDirective(skipDirectiveNode),
          includeDirective: compileIncludeDirective(includeDirectiveNode),
        },
        getCoercedVariableValues(operation),
        undefined,
        false,
      ),
    ).to.equal(false);
  });

  it('skips selections when @include is false', () => {
    const { skipDirectiveNode, includeDirectiveNode, operation } =
      getDirectiveNodes('{ field @include(if: false) }');

    expect(
      shouldIncludeSelection(
        {
          skipDirective: compileSkipDirective(skipDirectiveNode),
          includeDirective: compileIncludeDirective(includeDirectiveNode),
        },
        getCoercedVariableValues(operation),
        undefined,
        false,
      ),
    ).to.equal(false);
  });

  it('includes selections when @skip is false and @include is true', () => {
    const { skipDirectiveNode, includeDirectiveNode, operation } =
      getDirectiveNodes(
        'query ($show: Boolean!) { field @skip(if: false) @include(if: $show) }',
      );

    expect(
      shouldIncludeSelection(
        {
          skipDirective: compileSkipDirective(skipDirectiveNode),
          includeDirective: compileIncludeDirective(includeDirectiveNode),
        },
        getCoercedVariableValues(operation, { show: true }),
        undefined,
        false,
      ),
    ).to.equal(true);
  });
});
