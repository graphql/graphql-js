// @flow strict

import nodejsCustomInspectSymbol from './nodejsCustomInspectSymbol';

/**
 * The `defineToJSON()` function defines toJSON() and inspect() prototype
 * methods, if no function provided they become aliases for toString().
 */
export default function defineToJSON(
  // eslint-disable-next-line flowtype/no-weak-types
  classObject: Class<any> | Function,
  fn?: () => any = classObject.prototype.toString,
): void {
  classObject.prototype.toJSON = fn;
  classObject.prototype.inspect = fn;
  if (nodejsCustomInspectSymbol) {
    classObject.prototype[nodejsCustomInspectSymbol] = fn;
  }
}
