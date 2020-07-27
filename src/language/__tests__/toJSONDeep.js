import isObjectLike from '../../jsutils/isObjectLike';

/**
 * Deeply transforms an arbitrary value to a JSON-safe value by calling toJSON
 * on any nested value which defines it.
 */
export default function toJSONDeep(value: mixed): mixed {
  if (!isObjectLike(value)) {
    return value;
  }

  if (typeof value.toJSON === 'function') {
    // $FlowFixMe(>=0.90.0)
    return value.toJSON();
  }

  if (Array.isArray(value)) {
    return value.map(toJSONDeep);
  }

  const result = Object.create(null);
  for (const prop of Object.keys(value)) {
    result[prop] = toJSONDeep(value[prop]);
  }
  return result;
}
