# Contributing to graphql-js

We want to make contributing to this project as easy and transparent as
possible. Hopefully this document makes the process for contributing clear and
answers any questions you may have. If not, feel free to open an
[Issue](https://github.com/graphql/graphql-spec/issues/).

## Issues

We use GitHub issues to track public bugs and requests. Please ensure your bug
description is clear and has sufficient instructions to be able to reproduce the
issue. The best way is to provide a reduced test case on jsFiddle or jsBin.

## Pull Requests

All active development of graphql-js happens on GitHub. We actively welcome
your [pull requests](https://help.github.com/articles/creating-a-pull-request).

### Considered Changes

Since graphql-js is a reference implementation of the
[GraphQL spec](https://graphql.github.io/graphql-spec/), only changes which comply
with this spec will be considered. If you have a change in mind which requires a
change to the spec, please first open an
[issue](https://github.com/graphql/graphql-spec/issues/) against the spec.

### GraphQL Specification Membership Agreement

This repository is managed by EasyCLA. Project participants must sign the free ([GraphQL Specification Membership agreement](https://preview-spec-membership.graphql.org) before making a contribution. You only need to do this one time, and it can be signed by [individual contributors](http://individual-spec-membership.graphql.org/) or their [employers](http://corporate-spec-membership.graphql.org/).

To initiate the signature process please open a PR against this repo. The EasyCLA bot will block the merge if we still need a membership agreement from you.

You can find [detailed information here](https://github.com/graphql/graphql-wg/tree/main/membership). If you have issues, please email [operations@graphql.org](mailto:operations@graphql.org).

If your company benefits from GraphQL and you would like to provide essential financial support for the systems and people that power our community, please also consider membership in the [GraphQL Foundation](https://foundation.graphql.org/join).

### Getting Started

1. Fork this repo by using the "Fork" button in the upper-right

2. Check out your fork

   ```sh
   git clone git@github.com:your_name_here/graphql-js.git
   ```

3. Install or Update all dependencies

   ```sh
   npm install
   ```

4. Get coding! If you've added code, add tests. If you've changed APIs, update
   any relevant documentation or tests. Ensure your work is committed within a
   feature branch.

5. Ensure all tests pass

   ```sh
   npm test
   ```

## Coding Style

This project uses [Prettier](https://prettier.io/) for standard formatting. To
ensure your pull request matches the style guides, run `npm run prettier`.

- 2 spaces for indentation (no tabs)
- 80 character line length strongly preferred.
- Prefer `'` over `"`
- ES6 syntax when possible. However do not rely on ES6-specific functions to be available.
- Use [TypeScript](https://www.typescriptlang.org).
- Use semicolons;
- Trailing commas,
- Avd abbr wrds.

## Executable API examples

Run `npm run check:examples` to execute all JavaScript and TypeScript fences under
JSDoc `@example` tags in `src`. No package build is needed. CI runs the same check
alongside the other lint checks.

Each fence runs separately: include its imports and setup. The runner rewrites
imports and assertion comments, transpiles examples with TypeScript, and executes
them in memory using Mocha and the existing Babel source loader. Imports from `graphql` resolve directly to the
source in `src`.
It checks runtime behavior, not TypeScript types. GraphQL fences are not executed.
Examples without expectations are smoke tests.

Add a fenced example under `@example` in the API's JSDoc comment. Use trailing
comments to describe expected results:

````ts
/**
 * Parses a GraphQL document.
 * @example
 * ```ts
 * import { parse } from 'graphql';
 *
 * parse('{ hello }').kind; // => 'Document'
 * parse('invalid'); // throws an error
 * parse('{ hello }'); // does not throw
 * ```
 */
````

Annotations can follow an expression statement or a variable declaration.
On a declaration, `// =>` compares the initializer's result and the variable
keeps that value:

```ts
import { parse } from 'graphql';

const kind = parse('{ hello }').kind; // => 'Document'
kind.toLowerCase(); // => 'document'
```

Use one initialized variable declaration per annotation. Destructuring checks the
whole initializer's result before assigning its properties to the variables.

Top-level `await` is supported. Inside an example fence, an async result can be
checked like this:

```ts
import { buildSchema, graphql } from 'graphql';

const schema = buildSchema('type Query { hello: String }');
const result = await graphql({
  schema,
  source: '{ hello }',
  rootValue: { hello: () => 'world' },
});

result; // => { data: { hello: 'world' } }
```

For an expected promise rejection, use
`await Promise.reject(new Error('expected')); // throws an error`.

Keep the expected expression on the same line as `// =>`. For a multiline value,
define a variable and reference it in the expectation:

```ts
import { buildSchema, printSchema } from 'graphql';

const schema = buildSchema('type Query { hello: String }');
const expected = `type Query {
  hello: String
}`;

printSchema(schema); // => expected
```

Comparisons use the existing `expectJSON` test helper. It calls `toJSON` methods
and compares object properties, including GraphQL's null-prototype dictionaries.
Missing properties and properties set to `undefined` remain distinct.

Assertions can appear inside callbacks, functions, loops, and conditional blocks.
Every annotated expression must execute at least once before the example finishes:

```ts
import { parse, visit } from 'graphql';

visit(parse('{ greeting }'), {
  Field(node) {
    node.name.value; // => 'greeting'
  },
});
```

An uncalled callback or a skipped branch containing an assertion fails the check.
Await asynchronous work so its assertions run before the example finishes.
Repeated calls to one assertion do not compensate for another that never runs.

Invalid annotations and unexpected errors fail the check, with the example's
source file and line in the output.
Examples run sequentially and share GraphQL module state. They should not
interfere with one another.

## Release on NPM

Releases on `16.x.x` are managed by local scripts and GitHub Actions:

```bash
git switch 16.x.x
git switch -c <my_release_branch>
export GH_TOKEN=<token> # required to build changelog via GitHub API requests
npm run release:prepare -- 16.x.x patch
```

Stable `16.x.x` releases publish to npm with the `latest-16` tag so they do
not replace the package `latest` tag, and their GitHub releases are explicitly
not marked as the latest release. Users can install this line with a semver
specifier, for example `npm install graphql@16`.

Push `<my_release_branch>`, open a PR from `<my_release_branch>` to `16.x.x`,
wait for CI to pass, merge the PR, and then approve the GitHub Actions release
workflow.

## License

By contributing to graphql-js, you agree that your contributions will be
licensed under its [MIT license](../LICENSE).
