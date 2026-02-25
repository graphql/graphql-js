# Changesets in graphql-js

This repo uses Changesets to manage version bumps and release PR automation.

## Contributor flow

1. Add a changeset file when the PR should affect a published package:
   - `npm run changeset`
   - Choose `patch`, `minor`, or `major` for `graphql`
2. Commit the generated `.changeset/*.md` file.

## Release lines

Changesets automation is currently enabled only on `17.x.x`.
