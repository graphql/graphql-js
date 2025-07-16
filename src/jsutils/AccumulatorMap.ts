/**
 * ES6 Map with additional `add` method to accumulate items.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export class AccumulatorMap<K, T> extends Map<K, Array<T>> {
  override get [Symbol.toStringTag]() {
    return 'AccumulatorMap';
  }

  add(key: K, item: T): void {
    const group = this.get(key);
    if (group === undefined) {
      this.set(key, [item]);
    } else {
      group.push(item);
    }
  }
}
