// Temporary compatibility helper.
//
// Node 22 cannot parse `await using` syntax in test files, but we still want to
// exercise the real syntax on newer Node versions.
//
// Remove when we can drop support for Node 22 and use `await using` directly in each test.
/* node:coverage ignore next 10 */
const supportsAsyncUsing = (() => {
  try {
    // Compile the syntax probe dynamically so older Node versions can parse this file.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    Function('async function test() { await using resource = null; }');
    return true;
  } catch {
    return false;
  }
})();

/* node:coverage ignore next 2 */
const asyncDispose: typeof Symbol.asyncDispose =
  Symbol.asyncDispose ?? Symbol.for('Symbol.asyncDispose');

export async function withAsyncUsing<T>(
  value: T,
  useResource: (resource: T) => void | Promise<void>,
): Promise<void> {
  // On Node 24+, supportsAsyncUsing is true and this branch is unreachable.
  // On Node 22, this is the branch that gets executed.
  /* node:coverage ignore next 26 */
  if (!supportsAsyncUsing) {
    try {
      await useResource(value);
    } finally {
      const dispose = (value as { [key: symbol]: unknown })[asyncDispose];
      if (typeof dispose === 'function') {
        await dispose.call(value);
      }
    }
    return;
  }

  {
    // Keep `await using` in a dynamically compiled function so Node 22 can still
    // parse this file while newer runtimes exercise the real syntax.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const createRunWithAsyncUsing = new Function(
      'return async function(value, useResource) { await using resource = value; await useResource(resource); };',
    ) as () => (
      value: T,
      useResource: (resource: T) => void | Promise<void>,
    ) => Promise<void>;

    const runWithAsyncUsing = createRunWithAsyncUsing();
    await runWithAsyncUsing(value, useResource);
  }
}
