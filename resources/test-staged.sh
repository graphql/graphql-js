#!/bin/sh -e

# stash all unstaged changes
# (-k: unstaged files; -u: untracked files; -q: quite)
echo '--------------------------------------------------------------'
echo '---- Stash all unstaged/untracked files (git stash -k -u) ----'
echo '--------------------------------------------------------------'
BEFORE_STASH_HASH=$(git rev-parse refs/stash)
git stash -k -u -q
AFTER_STASH_HASH=$(git rev-parse refs/stash)
if [ "$BEFORE_STASH_HASH" == "$AFTER_STASH_HASH" ]; then
  echo '\n\n---- Stash failed! Please check and retry. ----\n\n';
  exit 1;
fi;

# run test only with staged files
echo '-------------------'
echo '---- Run tests ----'
echo '-------------------'
yarn run test ||
(echo '\n\n---- Tests failed! Please fix it before commit. ----\n\n')

# restore all stashed changes
# http://stackoverflow.com/questions/41304610/
echo '-----------------------------------------------------------'
echo '---- Restore all stashed files (git stash pop --index) ----'
echo '-----------------------------------------------------------'
git reset --hard -q &&
git clean -df -q &&
git stash pop --index -q ||
(echo '\n\n---- Restore failed! Please check and fix it. ----\n\n')
