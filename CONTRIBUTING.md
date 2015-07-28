Contributing to graphql-js
==========================

We want to make contributing to this project as easy and transparent as
possible. Hopefully this document makes the process for contributing clear and
answers any questions you may have. If not, feel free to open an
[Issue](https://github.com/facebook/graphql/issues).

## Getting Started

1. Fork this repo by using the "Fork" button in the upper-right

2. Check out your fork

   ```sh
   git clone git@github.com:yournamehere/graphql-js.git
   ```

3. Install all dependencies

   ```sh
   npm install
   ```

4. Get coding! If you've added code, add tests. If you've changed APIs, update
   any relevant documentation or tests.

5. Ensure all tests pass

   ```sh
   npm test
   ```

### Live Feedback

While actively developing, we recommend running `npm run watch` in a terminal.
This will watch the file system run any relevant lint, tests, and type checks automatically whenever you save a `.js` file.

### Release on NPM

*Only core contributors may release to NPM.*

To release a new version on NPM, use `npm version patch|minor|major` in order
to increment the version in package.json and tag and commit a release. Then
`git push --tags` this change so Travis CI can deploy to NPM. *Do not run
`npm publish` directly.* Once published, add
[release notes](https://github.com/graphql/graphql-js/tags). Use [semver](http://semver.org/) to determine which version to increment.

## Pull Requests

All active development of graphql-js happens on GitHub. We actively welcome
your [pull requests](https://help.github.com/articles/creating-a-pull-request).

### Considered Changes

Since graphql-js is a reference implementation of the
[GraphQL spec](https://facebook.github.io/graphql/), only changes which comply
with this spec will be considered. If you have a change in mind which requires a
change to the spec, please first open an
[issue](https://github.com/facebook/graphql/issues/) against the spec.

### Contributor License Agreement ("CLA")

In order to accept your pull request, we need you to submit a CLA. You only need
to do this once to work on any of Facebook's open source projects.

Complete your CLA here: <https://code.facebook.com/cla>

## Issues

We use GitHub issues to track public bugs and requests. Please ensure your bug
description is clear and has sufficient instructions to be able to reproduce the
issue. The best way is to provide a reduced test case on jsFiddle or jsBin.

Facebook has a [bounty program](https://www.facebook.com/whitehat/) for the safe
disclosure of security bugs. In those cases, please go through the process
outlined on that page and do not file a public issue.

## Coding Style

* 2 spaces for indentation (no tabs)
* 80 character line length strongly preferred.
* Prefer `'` over `"`
* ES6 syntax when possible.
* Use [Flow types](http://flowtype.org/).
* Use semicolons;
* Trailing commas,
* Avd abbr wrds.

## License

By contributing to graphql-js, you agree that your contributions will be
licensed under its BSD license.
