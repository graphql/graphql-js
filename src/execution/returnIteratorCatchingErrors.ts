/** @internal */
export async function returnIteratorCatchingErrors(
  iterator: AsyncIterator<unknown>,
): Promise<void> {
  try {
    await iterator.return?.();
  } catch {
    // ignore errors
  }
}
