/** Used to extract values from enum-like objects. */
export type ValueTypes<TObj extends { [key: string]: unknown }> =
  TObj[keyof TObj];
