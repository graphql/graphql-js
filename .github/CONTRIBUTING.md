# Contributing to graphql-js

We want to make contributing to this project as easy and transparent as
possible. Hopefully this document makes the process for contributing clear and
answers any questions you may have. If not, feel free to open an
[Issue](https://github.com/graphql/graphql-spec/issues/).

## Issues

We use GitHub issues to track public bugs and requests. Please ensure your bug
description is clear and has sufficient instructions to be able to reproduce the
issue. The best way is to provide a reduced test case on jsFiddle or jsBin.

Facebook has a [bounty program](https://www.facebook.com/whitehat/) for the safe
disclosure of security bugs. In those cases, please go through the process
outlined on that page and do not file a public issue.

## Pull Requests

All active development of graphql-js happens on GitHub. We actively welcome
your [pull requests](https://help.github.com/articles/creating-a-pull-request).

### Considered Changes

Since graphql-js is a reference implementation of the
[GraphQL spec](https://graphql.github.io/graphql-spec/), only changes which comply
with this spec will be considered. If you have a change in mind which requires a
change to the spec, please first open an
[issue](https://github.com/graphql/graphql-spec/issues/) against the spec.

### Contributor License Agreement ("CLA")

In order to accept your pull request, we need you to submit a CLA. You only need
to do this once to work on any of Facebook's open source projects.

Complete your CLA here: <https://code.facebook.com/cla>

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
- Use [Flow types](https://flowtype.org/).
- Use semicolons;
- Trailing commas,
- Avd abbr wrds.

## Release on NPM

Releases on `15.x.x` are managed by local scripts and GitHub Actions:

```bash
git switch 15.x.x
git switch -c <my_release_branch>
export GH_TOKEN=<token> # required to build changelog via GitHub API requests
npm run release:prepare -- 15.x.x patch
```

Stable `15.x.x` releases publish to npm with the `latest-15` tag so they do
not replace the package `latest` tag, and their GitHub releases are explicitly
not marked as the latest release. Users can install this line with a semver
specifier, for example `npm install graphql@15`.

Push `<my_release_branch>`, open a PR from `<my_release_branch>` to `15.x.x`,
wait for CI to pass, merge the PR, and then approve the GitHub Actions release
workflow.

## License

By contributing to graphql-js, you agree that your contributions will be
licensed under its [MIT license](../LICENSE).
