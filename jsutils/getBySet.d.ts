export declare function getBySet<T, U>(
  map: ReadonlyMap<ReadonlySet<T>, U>,
  setToMatch: ReadonlySet<T>,
): U | undefined;
