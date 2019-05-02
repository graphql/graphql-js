# Exit immediately if any subcommand terminated
trap "exit 1" ERR

# Publishing to NPM is currently supported by Travis CI, which ensures that all
# tests pass first and the deployed module contains the correct file structure.
# In order to prevent inadvertently circumventing this, we ensure that a CI
# environment exists before continuing.
if [ "$CI" != true ]; then
  echo "\n\n\n  \033[101;30m Only Travis CI can publish to NPM. \033[0m" 1>&2;
  echo "  Ensure git is left is a good state by backing out any commits and deleting any tags." 1>&2;
  echo "  Then read CONTRIBUTING.md to learn how to publish to NPM.\n\n\n" 1>&2;
  exit 1;
fi;

# When Travis CI publishes to NPM, the published files are available in the root
# directory, which allows for a clean include or require of sub-modules.
npm run build
cp -r ./dist/* ./
