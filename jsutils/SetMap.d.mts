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
export declare class SetMap<T, V> {
    _entries: Map<string, SetMapEntry<T, V>>;
    _memberIds: Map<T, number>;
    _nextMemberId: number;
    constructor();
    get size(): number;
    get(members: ReadonlySet<T>): V | undefined;
    getOrInsert(members: ReadonlySet<T>, value: V): V;
    getOrInsertComputed(members: ReadonlySet<T>, computeValue: (members: ReadonlySet<T>) => V): V;
    has(members: ReadonlySet<T>): boolean;
    set(members: ReadonlySet<T>, value: V): this;
    keys(): IterableIterator<ReadonlySet<T>>;
    values(): IterableIterator<V>;
    entries(): IterableIterator<[ReadonlySet<T>, V]>;
    [Symbol.iterator](): IterableIterator<[ReadonlySet<T>, V]>;
    _key(members: ReadonlySet<T>): string;
}
export {};
