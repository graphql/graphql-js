/* eslint-disable import/no-commonjs */
// @flow strict

// FIXME: This file should remain as JS file, and has a supporting `d.ts` file,
// because it's in use by other areas of that repo (like benchmark tests).
// I should be converted to `.ts` after migrating the entire build system to TS.

const { join } = require('path');
const { readFileSync } = require('fs');

function readLocalFile(filename) {
  return readFileSync(join(__dirname, filename), 'utf8');
}

export const bigSchemaSDL = readLocalFile('github-schema.graphql');
export const bigSchemaIntrospectionResult = JSON.parse(
  readLocalFile('github-schema.json'),
);

export const kitchenSinkSDL = readLocalFile('schema-kitchen-sink.graphql');
export const kitchenSinkQuery = readLocalFile('kitchen-sink.graphql');
