/**
 * Maps an order-independent set of member identities to a value.
 * Each member receives a map-local ID; sorted IDs form the exact key.
 * @internal
 */
export class SetMap<T, V> {
  _entries: Map<string, V>;
  _memberIds: Map<T, number>;
  _nextMemberId: number;

  constructor() {
    this._entries = new Map();
    this._memberIds = new Map();
    this._nextMemberId = 0;
  }

  get(members: ReadonlySet<T>): V | undefined {
    return this._entries.get(this._key(members));
  }

  set(members: ReadonlySet<T>, value: V): void {
    this._entries.set(this._key(members), value);
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
