import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { VariableScope } from '../argumentsKey.ts';
import type {
  FieldSetProof,
  FieldSetProofMember,
} from '../FieldSetProofCache.ts';
import { FieldSetProofCache } from '../FieldSetProofCache.ts';

function fieldSet(): FieldSetProofMember {
  return {};
}

function effective(...fieldSets: Array<FieldSetProofMember>): FieldSetProof {
  const fieldSetsWithFields = new Set(fieldSets);
  return { getFieldSetsWithFields: () => fieldSetsWithFields };
}

function bound(
  template: FieldSetProofMember,
  variableScope: VariableScope,
): FieldSetProofMember {
  return {
    binding: { template, variableScope },
  };
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

  it('shares alpha-equivalent bound scope shapes', () => {
    const proofCache = new FieldSetProofCache();
    const firstTemplate = fieldSet();
    const secondTemplate = fieldSet();
    const firstScope = new Map([['value', 'first']]);
    const secondScope = new Map([['value', 'second']]);

    const first = effective(
      bound(firstTemplate, firstScope),
      bound(secondTemplate, firstScope),
    );
    const alphaEquivalent = effective(
      bound(firstTemplate, secondScope),
      bound(secondTemplate, secondScope),
    );
    const distinctScopes = effective(
      bound(firstTemplate, firstScope),
      bound(secondTemplate, secondScope),
    );

    expect(proofCache.shouldCheckResponseShape(first)).to.equal(true);
    expect(proofCache.shouldCheckResponseShape(alphaEquivalent)).to.equal(
      false,
    );
    expect(proofCache.shouldCheckResponseShape(distinctScopes)).to.equal(true);
  });

  it('includes unbound field sets in a bound proof shape', () => {
    const proofCache = new FieldSetProofCache();
    const template = fieldSet();
    const unbound = fieldSet();
    const mixed = effective(
      unbound,
      bound(template, new Map([['value', 'scope']])),
    );
    const equivalent = effective(
      unbound,
      bound(template, new Map([['value', 'other']])),
    );
    const differentUnboundStart = effective(
      fieldSet(),
      bound(template, new Map([['value', 'third']])),
    );

    expect(proofCache.shouldCheckResponseShape(mixed)).to.equal(true);
    expect(proofCache.shouldCheckResponseShape(equivalent)).to.equal(false);
    expect(proofCache.shouldCheckResponseShape(differentUnboundStart)).to.equal(
      true,
    );
  });

  it('preserves repeated occurrences of the same scope shape', () => {
    const proofCache = new FieldSetProofCache();
    const template = fieldSet();
    const oneScope = effective(bound(template, new Map([['value', 'first']])));
    const twoScopes = effective(
      bound(template, new Map([['value', 'second']])),
      bound(template, new Map([['value', 'third']])),
    );
    const equivalentTwoScopes = effective(
      bound(template, new Map([['value', 'fourth']])),
      bound(template, new Map([['value', 'fifth']])),
    );

    expect(proofCache.shouldCheckResponseShape(oneScope)).to.equal(true);
    expect(proofCache.shouldCheckResponseShape(twoScopes)).to.equal(true);
    expect(proofCache.shouldCheckResponseShape(equivalentTwoScopes)).to.equal(
      false,
    );
  });
});
