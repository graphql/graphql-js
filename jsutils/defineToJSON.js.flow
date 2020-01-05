// @flow strict

import nodejsCustomInspectSymbol from './nodejsCustomInspectSymbol';

/**
 * The `defineToJSON()` function defines toJSON() and inspect() prototype
 * methods, if no function provided they become aliases for toString().
 */
export default function defineToJSON(
  classObject: Class<any> | ((...args: Array<any>) => mixed),
  fn?: () => mixed = classObject.prototype.toString,
): void {
  classObject.prototype.toJSON = fn;
  classObject.prototype.inspect = fn;

  /* istanbul ignore else (See: https://github.com/graphql/graphql-js/issues/2317) */
  if (nodejsCustomInspectSymbol) {
    classObject.prototype[nodejsCustomInspectSymbol] = fn;
  }
}
