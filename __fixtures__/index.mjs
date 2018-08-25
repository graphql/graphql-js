import { join } from 'path';
import { readFileSync } from 'fs';

function readLocalFile(filename) {
  return readFileSync(join(__dirname, filename), 'utf8');
}

export var bigSchemaSDL = readLocalFile('github-schema.graphql');
export var bigSchemaIntrospectionResult = JSON.parse(readLocalFile('github-schema.json'));