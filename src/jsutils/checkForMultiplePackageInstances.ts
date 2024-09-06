const graphqlPackageInstanceCheckSymbol = Symbol.for(
  'graphql-js:check-multiple-package-instances',
);

class Check {}

/**
 * A check which throws an error warning when multi-realm constructors are detected.
 */
export function checkForMultiplePackageInstances() {
  const globalObject = globalThis as {
    [graphqlPackageInstanceCheckSymbol]?: Check;
  };
  if (!globalObject[graphqlPackageInstanceCheckSymbol]) {
    globalObject[graphqlPackageInstanceCheckSymbol] = new Check();
    return;
  }
  if (!(globalObject[graphqlPackageInstanceCheckSymbol] instanceof Check)) {
    // eslint-disable-next-line no-console
    console.error(
      new Error(
        `Multiple colliding versions of the \`graphql\` package detected.

Ensure that there is only one instance of "graphql" in the node_modules
directory. If different versions of "graphql" are the dependencies of other
relied on modules, use "resolutions" to ensure only one version is installed.

https://yarnpkg.com/en/docs/selective-version-resolutions

Duplicate "graphql" modules cannot be used at the same time since different
versions may have different capabilities and behavior. The data from one
version used in the function from another could produce confusing and
spurious results.`,
      ),
    );
  }
}
