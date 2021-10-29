# Exit immediately if any subcommand terminated
trap "exit 1" ERR

#
# This script determines if current git state is the up to date main. If so
# it exits normally. If not it prompts for an explicit continue. This script
# intends to protect from versioning for NPM without first pushing changes
# and including any changes on main.
#

# Check that local copy has no modifications
GIT_MODIFIED_FILES=$(git ls-files -dm 2> /dev/null);
GIT_STAGED_FILES=$(git diff --cached --name-only 2> /dev/null);
if [ "$GIT_MODIFIED_FILES" != "" -o "$GIT_STAGED_FILES" != "" ]; then
  read -p "Git has local modifications. Continue? (y|N) " yn;
  if [ "$yn" != "y" ]; then exit 1; fi;
fi;

# First fetch to ensure git is up to date. Fail-fast if this fails.
git fetch;
if [[ $? -ne 0 ]]; then exit 1; fi;

# Extract useful information.
GIT_BRANCH=$(git branch -v 2> /dev/null | sed '/^[^*]/d');
GIT_BRANCH_NAME=$(echo "$GIT_BRANCH" | sed 's/* \([A-Za-z0-9_\-]*\).*/\1/');
GIT_BRANCH_SYNC=$(echo "$GIT_BRANCH" | sed 's/* [^[]*.\([^]]*\).*/\1/');

# Check if main is checked out
if [ "$GIT_BRANCH_NAME" != "main" ]; then
  read -p "Git not on main but $GIT_BRANCH_NAME. Continue? (y|N) " yn;
  if [ "$yn" != "y" ]; then exit 1; fi;
fi;

# Check if branch is synced with remote
if [ "$GIT_BRANCH_SYNC" != "" ]; then
  read -p "Git not up to date but $GIT_BRANCH_SYNC. Continue? (y|N) " yn;
  if [ "$yn" != "y" ]; then exit 1; fi;
fi;
