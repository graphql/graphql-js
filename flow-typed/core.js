// Various hacks to compensate for outdated Flow core definitions

declare class Symbol extends Symbol {
  static asyncIterator: string; // polyfill '@@asyncIterator'
}
