#!/bin/sh -e

find ./src -name '*.js' -not -path '*/__tests__*' | while read filepath; do
  cp $filepath `echo $filepath | sed 's/\\/src\\//\\/dist\\/modules\\//g'`.flow;
  cp $filepath `echo $filepath | sed 's/\\/src\\//\\/dist\\/es5\\//g'`.flow;
done
