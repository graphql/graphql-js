import { describe, it } from 'node:test';

import { expect } from 'chai';

import { Kind } from '../../../language/kinds.ts';

import type {
  DeferUsage,
  FieldDetails,
  GroupedFieldSet,
} from '../../collectFields.ts';

import { inlineDeferUsages } from '../inlineDeferUsages.ts';

function createDeferUsage(parentDeferUsage?: DeferUsage): DeferUsage {
  return {
    directiveNode: {
      kind: Kind.DIRECTIVE,
      name: { kind: Kind.NAME, value: 'defer' },
    },
    label: undefined,
    parentDeferUsage,
  };
}

function createFieldDetails(deferUsage?: DeferUsage): FieldDetails {
  return {
    node: {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: 'name' },
    },
    deferUsage,
  };
}

describe('inlineDeferUsages', () => {
  it('preserves the original field set when every usage is admitted', () => {
    const deferUsage = createDeferUsage();
    const groupedFieldSet: GroupedFieldSet = new Map([
      ['name', [createFieldDetails(deferUsage)]],
    ]);

    expect(inlineDeferUsages(groupedFieldSet, [deferUsage], 1)).to.equal(
      groupedFieldSet,
    );
  });

  it('reuses normalized fields for the same admission prefix', () => {
    const outer = createDeferUsage();
    const middle = createDeferUsage(outer);
    const inner = createDeferUsage(middle);
    const newDeferUsages = [outer, middle, inner];
    const originalDetails = createFieldDetails(inner);
    const groupedFieldSet: GroupedFieldSet = new Map([
      ['name', [originalDetails]],
    ]);

    const oneAdmitted = inlineDeferUsages(groupedFieldSet, newDeferUsages, 1);
    const twoAdmitted = inlineDeferUsages(groupedFieldSet, newDeferUsages, 2);

    expect(inlineDeferUsages(groupedFieldSet, newDeferUsages, 1)).to.equal(
      oneAdmitted,
    );
    expect(twoAdmitted).to.not.equal(oneAdmitted);
    expect(oneAdmitted.get('name')?.[0].deferUsage).to.equal(outer);
    expect(twoAdmitted.get('name')?.[0].deferUsage).to.equal(middle);
    expect(originalDetails.deferUsage).to.equal(inner);
    expect(oneAdmitted.get('name')?.[0].node).to.equal(originalDetails.node);
  });

  it('retains admitted ancestors and unchanged field detail lists', () => {
    const ancestor = createDeferUsage();
    const outer = createDeferUsage(ancestor);
    const inner = createDeferUsage(outer);
    const unchangedDetails = [createFieldDetails(ancestor)];
    const changedDetails = createFieldDetails(inner);
    const groupedFieldSet: GroupedFieldSet = new Map([
      ['name', [unchangedDetails[0], changedDetails, unchangedDetails[0]]],
      ['unchanged', unchangedDetails],
    ]);

    const normalized = inlineDeferUsages(groupedFieldSet, [outer, inner], 0);

    const normalizedDetails = normalized.get('name');
    expect(normalizedDetails).to.have.lengthOf(3);
    expect(normalizedDetails?.[0]).to.equal(unchangedDetails[0]);
    expect(normalizedDetails?.[1].deferUsage).to.equal(ancestor);
    expect(normalizedDetails?.[2]).to.equal(unchangedDetails[0]);
    expect(changedDetails.deferUsage).to.equal(inner);
    expect(normalized.get('unchanged')).to.equal(unchangedDetails);
  });

  it('removes defer annotations when there is no admitted ancestor', () => {
    const outer = createDeferUsage();
    const inner = createDeferUsage(outer);
    const groupedFieldSet: GroupedFieldSet = new Map([
      ['name', [createFieldDetails(inner)]],
    ]);
    const newDeferUsages = [outer, inner];

    const normalized = inlineDeferUsages(groupedFieldSet, newDeferUsages, 0);

    expect(normalized.get('name')?.[0].deferUsage).to.equal(undefined);
    expect(inlineDeferUsages(groupedFieldSet, newDeferUsages, 0)).to.equal(
      normalized,
    );
  });

  it('normalizes later occurrences even when the field also executes unconditionally', () => {
    const outer = createDeferUsage();
    const inner = createDeferUsage(outer);
    const unchangedDetails = createFieldDetails();
    const originalDetails = createFieldDetails(inner);
    const groupedFieldSet: GroupedFieldSet = new Map([
      ['name', [unchangedDetails, originalDetails]],
    ]);

    const normalized = inlineDeferUsages(groupedFieldSet, [outer, inner], 0);
    const normalizedDetails = normalized.get('name');

    expect(normalizedDetails?.[0]).to.equal(unchangedDetails);
    expect(normalizedDetails?.[1].deferUsage).to.equal(undefined);
    expect(normalizedDetails?.[1].node).to.equal(originalDetails.node);
    expect(originalDetails.deferUsage).to.equal(inner);
  });
});
