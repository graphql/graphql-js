import { SetMap } from '../../../jsutils/SetMap.ts';

/** @internal */
export interface FieldSetProof {
  getFieldSetsWithFields: () => ReadonlySet<object>;
}

/**
 * Tracks the response-shape and common-parent proofs already checked for each
 * set of field-contributing FieldSets.
 *
 * @internal
 */
export class FieldSetProofCache {
  private _identitiesByProof = new WeakMap<FieldSetProof, object>();
  private _checkedResponseShapeProofs = new WeakSet<object>();
  private _checkedCommonParentProofs = new WeakSet<object>();
  private _identitiesByMembers: SetMap<object, object> | undefined;

  shouldCheckResponseShape(proof: FieldSetProof): boolean {
    return this._claim(this._checkedResponseShapeProofs, proof);
  }

  shouldCheckCommonParents(proof: FieldSetProof): boolean {
    return this._claim(this._checkedCommonParentProofs, proof);
  }

  private _claim(
    checkedProofs: WeakSet<object>,
    proof: FieldSetProof,
  ): boolean {
    const identity = this._getIdentity(proof);
    if (checkedProofs.has(identity)) {
      return false;
    }
    checkedProofs.add(identity);
    return true;
  }

  private _getIdentity(proof: FieldSetProof): object {
    const cached = this._identitiesByProof.get(proof);
    if (cached !== undefined) {
      return cached;
    }
    const identity = (this._identitiesByMembers ??= new SetMap()).getOrInsert(
      proof.getFieldSetsWithFields(),
      {},
    );
    this._identitiesByProof.set(proof, identity);
    return identity;
  }
}
