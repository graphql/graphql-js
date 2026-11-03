import { expect } from 'chai';
import { describe, it } from 'mocha';

import type {
  FragmentDefinitionNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionSetNode,
} from '../../language/ast';
import { parse } from '../../language/parser';

import { assertObjectType } from '../../type/definition';

import { buildSchema } from '../../utilities/buildASTSchema';

import { collectFields } from '../collectFields';

describe('collectFields selection-set visitor', () => {
  it('visits each collected selection set in traversal order', () => {
    const schema = buildSchema(
      'type Query { first: String, second: String, third: String }',
    );
    const document = parse(
      'query { first ...F ... on Query { third } } fragment F on Query { second }',
    );
    const operation = document.definitions[0] as OperationDefinitionNode;
    const fragment = document.definitions[1] as FragmentDefinitionNode;
    const visited: Array<SelectionSetNode> = [];
    const fields = collectFields(
      schema,
      { F: fragment },
      {},
      assertObjectType(schema.getQueryType()),
      operation.selectionSet,
      (selectionSet) => {
        visited.push(selectionSet);
      },
    );
    expect(visited).to.deep.equal([
      operation.selectionSet,
      fragment.selectionSet,
      (operation.selectionSet.selections[2] as InlineFragmentNode).selectionSet,
    ]);
    expect([...fields.keys()]).to.deep.equal(['first', 'second', 'third']);
  });
});
