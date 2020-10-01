import { join } from 'path';
import { readFileSync } from 'fs';

function readLocalFile(filename: string): string {
  return readFileSync(join(__dirname, filename), 'utf8');
}

export const kitchenSinkSDL: string = readLocalFile(
  'schema-kitchen-sink.graphql',
);
export const kitchenSinkQuery: string = readLocalFile('kitchen-sink.graphql');
