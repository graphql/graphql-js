export async function returnIteratorCatchingErrors(
  iterator: AsyncIterator<unknown>,
): Promise<void> {
  try {
    await iterator.return?.();
  } catch /* c8 ignore next 2 */ {
    // ignore errors
  }
}
