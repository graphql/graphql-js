/**
 * ES6 Map with additional `add` method to accumulate items.
 */
export class AccumulatorMap<K, T> extends Map<K, Array<T>> {
  get [Symbol.toStringTag]() {
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
