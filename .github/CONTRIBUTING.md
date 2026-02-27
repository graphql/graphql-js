# Contributing to graphql-js

We want to make contributing to this project as easy and transparent as
possible. Hopefully this document makes the process for contributing clear and
answers any questions you may have.

## Issues

We use GitHub issues to track public bugs and requests. Please ensure your bug
description is clear and has sufficient instructions to be able to reproduce the
issue. The absolute best way to do that is to add a failing test to our test suite via a pull request, but a reduced test case on a site like [StackBlitz](https://stackblitz.com/) or [CodeSandbox](https://codesandbox.io/) is also very helpful.

## Pull Requests

All active development of graphql-js happens on GitHub. We actively welcome
your [pull requests](https://help.github.com/articles/creating-a-pull-request).

### Considered Changes

Since graphql-js is a reference implementation of the
[GraphQL spec](https://graphql.github.io/graphql-spec/), only changes which comply
with this spec will be considered. If you have a change in mind which requires a
change to the spec, please consider opening an
[issue](https://github.com/graphql/graphql-spec/issues/) against the spec and/or attending a [GraphQL Working Group meeting](https://github.com/graphql/graphql-wg) to discuss your proposed change. See the [contribution guide of the specification](https://github.com/graphql/graphql-spec/blob/main/CONTRIBUTING.md) for further information. Stage 1 and 2 proposals may be implemented within graphql-js behind a feature flag.

### GraphQL Specification Membership Agreement

This repository is managed by EasyCLA. Project participants must sign the free [GraphQL Specification Membership agreement](https://preview-spec-membership.graphql.org) before making a contribution. You only need to do this one time, and it can be signed by [individual contributors](http://individual-spec-membership.graphql.org/) or their [employers](http://corporate-spec-membership.graphql.org/).

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

## Review and Merge Process

- Pull requests are required to pass all tests and checks before they can be merged.
- Ideally, pull requests should be reviewed by _at least two_ members of the [`@graphql/graphql-js-reviewers`](https://github.com/orgs/graphql/teams/graphql-js-reviewers) team before they are merged, preferably from separate organizations. For more complex pull requests, a larger cohort of reviewers is suggested.
- Any reviewer may request that the topic be brought for more in depth discussion at a [GraphQL JS Working Group meeting](https://github.com/graphql/graphql-js-wg/), where decisions will be made by consensus.
- A PR that has been merged without discussion at a GraphQL JS Working Group meeting can be revisited in any subsequent meeting; the PR may be reverted as a result of that discussion.

## Discussion

Feel free to reach out via the [graphql-js channel](https://discord.com/channels/625400653321076807/862957336082645006) on the [official Discord server](https://discord.graphql.org/) to discuss issues, pull requests, or anything graphql-js related.

## Release on NPM

Releases on `17.x.x` are managed by local scripts and GitHub Actions:

```bash
git switch 17.x.x
git switch -c <my_release_branch>
export GH_TOKEN=<token> # required to build changelog via GitHub API requests
npm run release:prepare -- 17.x.x patch
```

Push `<my_release_branch>`, open a PR from `<my_release_branch>` to `17.x.x`, wait for CI to pass, merge the PR, and then approve the GitHub Actions release workflow. The workflow currently runs in dry-run mode for testing.

## License

By contributing to graphql-js, you agree that your contributions will be
licensed under its [MIT license](../LICENSE).
