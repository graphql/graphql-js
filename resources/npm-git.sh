#!/bin/sh -e

# This script maintains a git branch which mirrors master but in a form that
# what will eventually be deployed to npm, allowing npm dependencies to use:
#
#     "graphql": "git://github.com/graphql/graphql-js.git#npm"
#

./node_modules/.bin/babel src --ignore __tests__ --out-dir npm

# Ensure a vanilla package.json before deploying so other tools do not interpret
# The built output as requiring any further transformation.
node -e "var package = require('./package.json'); \
  delete package.babel; delete package.scripts; delete package.options; \
  require('fs').writeFileSync('./npm/package.json', JSON.stringify(package, null, 2));"

cp README.md npm/
cp LICENSE npm/
cp PATENTS npm/

cd npm
git init
git config user.name "Travis CI"
git config user.email "github@fb.com"
git add .
git commit -m "Deploy master to NPM branch"
git push --force --quiet "https://${GH_TOKEN}@github.com/graphql/graphql-js.git" master:npm
