export function devAssert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
