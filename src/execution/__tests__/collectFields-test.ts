import { describe, it } from 'node:test';

import { expect } from 'chai';

import { invariant } from '../../jsutils/invariant.ts';

import { parse } from '../../language/parser.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { collectFields } from '../collectFields.ts';
import { validateExecutionArgs } from '../execute.ts';

const schema = buildSchema(`
  type Query {
    field: String
  }
`);

function collectRootFields(query: string) {
  const validatedExecutionArgs = validateExecutionArgs({
    schema,
    document: parse(query),
  });

  invariant('operation' in validatedExecutionArgs);

  const { operation, fragments, variableValues } = validatedExecutionArgs;

  const queryType = schema.getQueryType();

  invariant(queryType != null);

  return collectFields(
    schema,
    fragments,
    variableValues,
    queryType,
    operation.selectionSet,
    false,
  );
}

describe('collectFields', () => {
  describe('overlapping fragment spreads', () => {
    it('should not collect a deferred spread after a non-deferred spread has been collected', () => {
      const { newDeferUsages } = collectRootFields(`
        query {
          ...FragmentName
          ...FragmentName @defer
        }
        fragment FragmentName on Query {
          field
        }
      `);

      expect(newDeferUsages).to.have.lengthOf(0);
    });

    it('should not collect a deferred spread after a deferred spread has been collected', () => {
      const { newDeferUsages } = collectRootFields(`
        query {
          ...FragmentName @defer
          ...FragmentName @defer
        }
        fragment FragmentName on Query {
          field
        }
      `);

      expect(newDeferUsages).to.have.lengthOf(1);
    });

    it('should collect a non-deferred spread after a deferred spread has been collected', () => {
      const { groupedFieldSet } = collectRootFields(`
        query {
          ...FragmentName @defer
          ...FragmentName
        }
        fragment FragmentName on Query {
          field
        }
      `);

      const fieldDetailsList = groupedFieldSet.get('field');

      invariant(fieldDetailsList != null);

      expect(fieldDetailsList).to.have.lengthOf(2);
    });

    it('should not collect a non-deferred spread after a non-deferred spread has been collected', () => {
      const { groupedFieldSet } = collectRootFields(`
        query {
          ...FragmentName
          ...FragmentName
        }
        fragment FragmentName on Query {
          field
        }
      `);

      const fieldDetailsList = groupedFieldSet.get('field');

      invariant(fieldDetailsList != null);

      expect(fieldDetailsList).to.have.lengthOf(1);
    });
  });
});
