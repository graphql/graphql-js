/* eslint-disable no-redeclare */
// $FlowFixMe[name-already-bound] workaround for: https://github.com/facebook/flow/issues/4441
export const objectEntries = Object.entries || (obj => Object.keys(obj).map(key => [key, obj[key]]));
