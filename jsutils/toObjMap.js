import objectEntries from "../polyfills/objectEntries.mjs";
export default function toObjMap(obj) {
  /* eslint-enable no-redeclare */
  if (Object.getPrototypeOf(obj) === null) {
    return obj;
  }

  const map = Object.create(null);

  for (const [key, value] of objectEntries(obj)) {
    map[key] = value;
  }

  return map;
}
