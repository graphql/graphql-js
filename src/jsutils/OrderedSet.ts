const setContainingUndefined = new Set([undefined]);
const setsContainingOneItem = new WeakMap<object, Set<object | undefined>>();
const setsAppendedByUndefined = new WeakMap<
  ReadonlySet<object | undefined>,
  Set<object | undefined>
>();
const setsAppendedByDefined = new WeakMap<
  ReadonlySet<object | undefined>,
  WeakMap<object, Set<object | undefined>>
>();

function createOrderedSet<T extends object | undefined>(
  item: T,
): ReadonlySet<T | undefined> {
  if (item === undefined) {
    return setContainingUndefined;
  }

  let set = setsContainingOneItem.get(item);
  if (set === undefined) {
    set = new Set([item]);
    set.add(item);
    setsContainingOneItem.set(item, set);
  }
  return set as ReadonlyOrderedSet<T | undefined>;
}

function appendToOrderedSet<T extends object | undefined>(
  set: ReadonlySet<T | undefined>,
  item: T | undefined,
): ReadonlySet<T | undefined> {
  if (set.has(item)) {
    return set;
  }

  if (item === undefined) {
    let appendedSet = setsAppendedByUndefined.get(set);
    if (appendedSet === undefined) {
      appendedSet = new Set(set);
      appendedSet.add(undefined);
      setsAppendedByUndefined.set(set, appendedSet);
    }
    return appendedSet as ReadonlySet<T | undefined>;
  }

  let appendedSets = setsAppendedByDefined.get(set);
  if (appendedSets === undefined) {
    appendedSets = new WeakMap();
    setsAppendedByDefined.set(set, appendedSets);
    const appendedSet = new Set(set);
    appendedSet.add(item);
    appendedSets.set(item, appendedSet);
    return appendedSet as ReadonlySet<T | undefined>;
  }

  let appendedSet: Set<object | undefined> | undefined = appendedSets.get(item);
  if (appendedSet === undefined) {
    appendedSet = new Set<object | undefined>(set);
    appendedSet.add(item);
    appendedSets.set(item, appendedSet);
  }

  return appendedSet as ReadonlySet<T | undefined>;
}

export type ReadonlyOrderedSet<T> = ReadonlySet<T>;

const emptySet = new Set();

/**
 * A set that when frozen can be directly compared for equality.
 *
 * Sets are limited to JSON serializable values.
 *
 * @internal
 */
export class OrderedSet<T extends object | undefined> {
  _set: ReadonlySet<T | undefined> = emptySet as ReadonlySet<T>;
  constructor(items: Iterable<T>) {
    for (const item of items) {
      if (this._set === emptySet) {
        this._set = createOrderedSet(item);
        continue;
      }

      this._set = appendToOrderedSet(this._set, item);
    }
  }

  freeze(): ReadonlyOrderedSet<T> {
    return this._set as ReadonlyOrderedSet<T>;
  }
}
