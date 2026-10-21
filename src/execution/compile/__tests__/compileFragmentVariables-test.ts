import { describe, it } from 'node:test';

import { expect } from 'chai';

import { invariant } from '../../../jsutils/invariant.ts';

import type { FragmentSpreadNode } from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import { compileFragmentVariables } from '../compileFragmentVariables.ts';

function getFragmentCase(query: string): {
  fragmentSpread: FragmentSpreadNode;
} {
  const document = parse(query, { experimentalFragmentArguments: true });
  const operation = document.definitions[0];
  invariant(operation.kind === Kind.OPERATION_DEFINITION);
  const fragmentSpread = operation.selectionSet.selections[0];
  invariant(fragmentSpread.kind === Kind.FRAGMENT_SPREAD);
  return { fragmentSpread };
}

describe('compileFragmentVariables', () => {
  it('returns undefined when there are no variable entries', () => {
    const { fragmentSpread } = getFragmentCase(`
      {
        ...Fragment
      }

      fragment Fragment on Query {
        field
      }
    `);

    expect(
      compileFragmentVariables(fragmentSpread, Object.create(null)),
    ).to.equal(undefined);
  });
});
