import { SetMap } from '../../../jsutils/SetMap.ts';

import type { VariableScope } from './argumentsKey.ts';

/** @internal */
export interface FieldSetProofMember {
  binding?: {
    template: object;
    variableScope: VariableScope;
  };
}

/** @internal */
export interface FieldSetProof {
  getFieldSetsWithFields: () => ReadonlySet<FieldSetProofMember>;
}

/**
 * Tracks which effective field-set proofs have already been checked. Proofs
 * with equivalent fragment-variable bindings share the same identity.
 *
 * @internal
 */
export class FieldSetProofCache {
  private _identitiesByProof = new WeakMap<FieldSetProof, object>();
  private _checkedResponseShapeProofs = new WeakSet<object>();
  private _checkedCommonParentProofs = new WeakSet<object>();
  private _scopeShapesByTemplates: SetMap<object, object> | undefined;
  private _scopeOccurrencesByShape: WeakMap<object, Array<object>> | undefined;
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

    let templatesByScope: Map<VariableScope, Set<object>> | undefined;
    const fieldSetsWithFields = proof.getFieldSetsWithFields();
    for (const fieldSet of fieldSetsWithFields) {
      const binding = fieldSet.binding;
      if (binding === undefined) {
        continue;
      }
      const { template, variableScope } = binding;
      templatesByScope ??= new Map();
      let templates = templatesByScope.get(variableScope);
      if (templates === undefined) {
        templates = new Set();
        templatesByScope.set(variableScope, templates);
      }
      templates.add(template);
    }

    if (templatesByScope === undefined) {
      const identity = (this._identitiesByMembers ??= new SetMap()).getOrInsert(
        fieldSetsWithFields,
        {},
      );
      this._identitiesByProof.set(proof, identity);
      return identity;
    }

    const proofMembers = new Set<object>();
    for (const fieldSet of fieldSetsWithFields) {
      if (fieldSet.binding === undefined) {
        proofMembers.add(fieldSet);
      }
    }
    const shapeCounts = new Map<object, number>();
    const scopeShapes = (this._scopeShapesByTemplates ??= new SetMap());
    // A set key cannot represent duplicate shapes, so stable occurrence
    // objects preserve how many equivalent variable scopes appear.
    for (const templates of templatesByScope.values()) {
      const shape = scopeShapes.getOrInsertComputed(templates, () => ({}));
      const shapeCount = shapeCounts.get(shape) ?? 0;
      shapeCounts.set(shape, shapeCount + 1);
      const occurrences = this._getScopeOccurrences(shape);
      proofMembers.add((occurrences[shapeCount] ??= {}));
    }

    const identity = (this._identitiesByMembers ??= new SetMap()).getOrInsert(
      proofMembers,
      {},
    );
    this._identitiesByProof.set(proof, identity);
    return identity;
  }

  private _getScopeOccurrences(shape: object): Array<object> {
    const occurrencesByShape = (this._scopeOccurrencesByShape ??=
      new WeakMap());
    let occurrences = occurrencesByShape.get(shape);
    if (occurrences === undefined) {
      occurrences = [];
      occurrencesByShape.set(shape, occurrences);
    }
    return occurrences;
  }
}
