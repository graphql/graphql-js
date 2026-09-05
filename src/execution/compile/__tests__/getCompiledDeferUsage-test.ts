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

import { compileDeferDirective } from '../compileDeferDirective.ts';
import { getCompiledDeferUsage } from '../getCompiledDeferUsage.ts';

const schema = buildSchema('type Query { field: String }');

function getDeferDirectiveNode(query: string): {
  directiveNode: DirectiveNode | undefined;
  operation: OperationDefinitionNode;
} {
  const document = parse(query);
  const operation = document.definitions[0];
  invariant(operation.kind === Kind.OPERATION_DEFINITION);
  const selection = operation.selectionSet.selections[0];
  invariant(selection.kind === Kind.INLINE_FRAGMENT);
  return {
    directiveNode: selection.directives?.find(
      (directive) => directive.name.value === 'defer',
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

describe('getCompiledDeferUsage', () => {
  it('returns undefined when there is no defer directive', () => {
    const { directiveNode, operation } =
      getDeferDirectiveNode('{ ... { field } }');

    expect(
      getCompiledDeferUsage(
        { deferDirective: compileDeferDirective(directiveNode) },
        undefined,
        getCoercedVariableValues(operation),
        undefined,
        false,
      ),
    ).to.equal(undefined);
  });

  it('uses defer by default and reads static labels', () => {
    const { directiveNode, operation } = getDeferDirectiveNode(
      '{ ... @defer(label: "deferred") { field } }',
    );

    expect(
      getCompiledDeferUsage(
        { deferDirective: compileDeferDirective(directiveNode) },
        undefined,
        getCoercedVariableValues(operation),
        undefined,
        false,
      ),
    ).to.deep.equal({
      label: 'deferred',
      parentDeferUsage: undefined,
    });
  });

  it('treats null labels as absent labels', () => {
    const { directiveNode, operation } = getDeferDirectiveNode(
      '{ ... @defer(label: null) { field } }',
    );

    expect(
      getCompiledDeferUsage(
        { deferDirective: compileDeferDirective(directiveNode) },
        undefined,
        getCoercedVariableValues(operation),
        undefined,
        false,
      ),
    ).to.deep.equal({
      label: undefined,
      parentDeferUsage: undefined,
    });
  });

  it('skips defer usage when if is false', () => {
    const { directiveNode, operation } = getDeferDirectiveNode(
      '{ ... @defer(if: false) { field } }',
    );

    expect(
      getCompiledDeferUsage(
        { deferDirective: compileDeferDirective(directiveNode) },
        undefined,
        getCoercedVariableValues(operation),
        undefined,
        false,
      ),
    ).to.equal(undefined);
  });

  it('uses runtime variables and preserves parent defer usage', () => {
    const { directiveNode, operation } = getDeferDirectiveNode(
      'query ($defer: Boolean!) { ... @defer(if: $defer) { field } }',
    );
    const parentDeferUsage = {
      label: 'parent',
      parentDeferUsage: undefined,
    };

    expect(
      getCompiledDeferUsage(
        { deferDirective: compileDeferDirective(directiveNode) },
        parentDeferUsage,
        getCoercedVariableValues(operation, { defer: true }),
        undefined,
        false,
      ),
    ).to.deep.equal({
      label: undefined,
      parentDeferUsage,
    });
  });
});
