/**
 * Change readonly property
 * @see https://stackoverflow.com/a/58904378/11321732
 */
export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};
