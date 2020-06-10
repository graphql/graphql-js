const flatMapMethod = Array.prototype.flatMap;
/* eslint-disable no-redeclare */
// $FlowFixMe

const flatMap = flatMapMethod ? function (list, fn) {
  return flatMapMethod.call(list, fn);
} : function (list, fn) {
  let result = [];

  for (const item of list) {
    const value = fn(item);

    if (Array.isArray(value)) {
      result = result.concat(value);
    } else {
      result.push(value);
    }
  }

  return result;
};
export default flatMap;
