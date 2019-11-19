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
   git clone git@github.com:yournamehere/graphql-js.git
   ```

3. Install or Update all dependencies

   ```sh
   cd graphql-js && yarn/npm install
   ```

4. Get coding! If you've added code, add tests. If you've changed APIs, update
   any relevant documentation or tests. Ensure your work is committed within a
   feature branch.

5. Ensure all tests pass

   ```sh
   yarn/npm test
   ```

6. A typical solution for working on a library is to test changes in your application project through `linking`.
  - Using `yarn/npm link`:
    - Either trigger a build manually by running `yarn/npm build`
    - Make your grapphql-js package available to link: `cd dist && yarn/npm link`
    - Link the package into your project: `cd my/app && yarn/npm link graphql`
  - Or you can to use [yalc](https://github.com/whitecolor/yalc)
    - Install `yalc`: `yarn global add yalc` or `npm i yalc -g`
    - Either trigger a build manually by running `yarn/npm build`
    - Run `cd dist && yalc publish --private` in your graphql-js package
    - Run `cd my/app && yalc add graphql` in your dependent project

### Live Feedback

While actively developing, we recommend running `npm run watch` in a terminal.
This will watch the file system run any relevant lint, tests, and type checks automatically whenever you save a `.js` file.

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

_Only core contributors may release to NPM._

To release a new version on NPM, first ensure all tests pass with `npm test`,
then use `npm version patch|minor|major` in order to increment the version in
package.json and tag and commit a release. Then `git push && git push --tags`
this change so Travis CI can deploy to NPM. _Do not run `npm publish` directly._
Once published, add [release notes](https://github.com/graphql/graphql-js/tags).
Use [semver](https://semver.org/) to determine which version part to increment.

Example for a patch release:

```sh
npm test
npm version patch
git push --follow-tags
```

## License

By contributing to graphql-js, you agree that your contributions will be
licensed under its MIT license.
