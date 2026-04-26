type InterceptedMethod = (this: unknown, ...args: Array<unknown>) => unknown;

/**
 * Replace one method on an object for the duration of a test and return a
 * restore callback for putting the original method back.
 */
export function interceptMethod(
  target: object,
  key: string,
  createReplacement: (original: InterceptedMethod) => InterceptedMethod,
): () => void {
  const objectTarget = target as { [key: string]: unknown };
  const original = objectTarget[key] as InterceptedMethod;
  objectTarget[key] = createReplacement(original);

  return () => {
    objectTarget[key] = original;
  };
}
