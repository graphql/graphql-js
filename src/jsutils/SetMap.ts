interface SetMapEntry<T, V> {
  members: ReadonlySet<T>;
  value: V;
}

/**
 * Maps an order-independent set of member identities to a value. Unlike a
 * `Map<ReadonlySet<T>, V>`, two sets containing the same members address the
 * same entry even when they are different `Set` objects.
 *
 * Each member receives a map-local numeric ID. Sorting those IDs produces an
 * exact, order-independent key.
 *
 * Iteration follows insertion order and returns the first `Set` object stored
 * for each key. Key sets must not be mutated after insertion.
 *
 * @internal
 * @typeParam T - A member of a map key.
 * @typeParam V - The value associated with a set of members.
 */
export class SetMap<T, V> {
  // Retains the first Set object for each key and preserves insertion order.
  _entries: Map<string, SetMapEntry<T, V>>;
  _memberIds: Map<T, number>;
  _nextMemberId: number;

  constructor() {
    this._entries = new Map();
    this._memberIds = new Map();
    this._nextMemberId = 0;
  }

  get size(): number {
    return this._entries.size;
  }

  get(members: ReadonlySet<T>): V | undefined {
    return this._find(members)?.value;
  }

  getOrInsert(members: ReadonlySet<T>, value: V): V {
    const entry = this._find(members);
    if (entry !== undefined) {
      return entry.value;
    }

    this._create(members, value);
    return value;
  }

  getOrInsertComputed(
    members: ReadonlySet<T>,
    computeValue: (members: ReadonlySet<T>) => V,
  ): V {
    const entry = this._find(members);
    if (entry !== undefined) {
      return entry.value;
    }

    const value = computeValue(members);
    this.set(members, value);
    return value;
  }

  has(members: ReadonlySet<T>): boolean {
    return this._find(members) !== undefined;
  }

  set(members: ReadonlySet<T>, value: V): this {
    const entry = this._find(members);
    if (entry !== undefined) {
      entry.value = value;
      return this;
    }

    this._create(members, value);
    return this;
  }

  *keys(): IterableIterator<ReadonlySet<T>> {
    for (const entry of this._entries.values()) {
      yield entry.members;
    }
  }

  *values(): IterableIterator<V> {
    for (const entry of this._entries.values()) {
      yield entry.value;
    }
  }

  *entries(): IterableIterator<[ReadonlySet<T>, V]> {
    for (const entry of this._entries.values()) {
      yield [entry.members, entry.value];
    }
  }

  [Symbol.iterator](): IterableIterator<[ReadonlySet<T>, V]> {
    return this.entries();
  }

  _find(members: ReadonlySet<T>): SetMapEntry<T, V> | undefined {
    return this._entries.get(this._key(members));
  }

  _create(members: ReadonlySet<T>, value: V): void {
    const entry = { members, value };
    this._entries.set(this._key(members), entry);
  }

  _key(members: ReadonlySet<T>): string {
    const ids = [];
    for (const member of members) {
      let id = this._memberIds.get(member);
      if (id === undefined) {
        id = this._nextMemberId++;
        this._memberIds.set(member, id);
      }
      ids.push(id);
    }
    ids.sort((id1, id2) => id1 - id2);
    return ids.join(',');
  }
}
