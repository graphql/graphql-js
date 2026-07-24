import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { FieldSetProof } from '../FieldSetProofCache.ts';
import { FieldSetProofCache } from '../FieldSetProofCache.ts';

function fieldSet(): object {
  return {};
}

function effective(...fieldSets: Array<object>): FieldSetProof {
  const fieldSetsWithFields = new Set(fieldSets);
  return { getFieldSetsWithFields: () => fieldSetsWithFields };
}

describe('FieldSetProofCache', () => {
  it('only checks a response-shape proof once', () => {
    const effectiveFieldSet = effective(fieldSet());
    const proofCache = new FieldSetProofCache();

    expect(proofCache.shouldCheckResponseShape(effectiveFieldSet)).to.equal(
      true,
    );
    expect(proofCache.shouldCheckResponseShape(effectiveFieldSet)).to.equal(
      false,
    );
  });

  it('tracks common-parent proofs independently', () => {
    const effectiveFieldSet = effective(fieldSet());
    const proofCache = new FieldSetProofCache();

    expect(proofCache.shouldCheckResponseShape(effectiveFieldSet)).to.equal(
      true,
    );
    expect(proofCache.shouldCheckCommonParents(effectiveFieldSet)).to.equal(
      true,
    );
    expect(proofCache.shouldCheckCommonParents(effectiveFieldSet)).to.equal(
      false,
    );
  });

  it('shares unbound proofs with the same field sets', () => {
    const proofCache = new FieldSetProofCache();
    const first = effective(fieldSet());
    const second = effective(...first.getFieldSetsWithFields());

    expect(proofCache.shouldCheckResponseShape(first)).to.equal(true);
    expect(proofCache.shouldCheckResponseShape(second)).to.equal(false);
  });
});
