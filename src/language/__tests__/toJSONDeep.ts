import { isObjectLike } from '../../jsutils/isObjectLike';

/**
 * Deeply transforms an arbitrary value to a JSON-safe value by calling toJSON
 * on any nested value which defines it.
 */
export function toJSONDeep(value: unknown): unknown {
  if (!isObjectLike(value)) {
    return value;
  }

  if (typeof value.toJSON === 'function') {
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
