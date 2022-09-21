'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.toError = void 0;
const inspect_js_1 = require('./inspect.js');
/**
 * Sometimes a non-error is thrown, wrap it as an Error instance to ensure a consistent Error interface.
 */
function toError(thrownValue) {
  return thrownValue instanceof Error
    ? thrownValue
    : new NonErrorThrown(thrownValue);
}
exports.toError = toError;
class NonErrorThrown extends Error {
  constructor(thrownValue) {
    super('Unexpected error value: ' + (0, inspect_js_1.inspect)(thrownValue));
    this.name = 'NonErrorThrown';
    this.thrownValue = thrownValue;
  }
}
