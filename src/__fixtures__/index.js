import { join } from 'path';
import { readFileSync } from 'fs';

function readLocalFile(filename) {
  return readFileSync(join(__dirname, filename), 'utf8');
}

export const bigSchemaSDL = readLocalFile('github-schema.graphql');
export const bigSchemaIntrospectionResult = JSON.parse(
  readLocalFile('github-schema.json'),
);
