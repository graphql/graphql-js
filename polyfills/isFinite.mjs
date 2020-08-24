/* eslint-disable no-redeclare */
// $FlowFixMe[name-already-bound] workaround for: https://github.com/facebook/flow/issues/4441
var isFinitePolyfill = Number.isFinite || function (value) {
  return typeof value === 'number' && isFinite(value);
};

export default isFinitePolyfill;
