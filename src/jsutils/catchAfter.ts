export async function catchAfter<T, U>(
  promise: Promise<T>,
  onError: (error: any) => U,
): Promise<T | U> {
  try {
    return await promise;
  } catch (error) {
    return onError(error);
  }
}
