import fs from 'node:fs';

export const bigSchemaSDL = fs.readFileSync(
  new URL('github-schema.graphql', import.meta.url),
  'utf8',
);

export const bigSchemaIntrospectionResult = JSON.parse(
  fs.readFileSync(new URL('github-schema.json', import.meta.url), 'utf8'),
);

export const bigDocumentSDL = fs.readFileSync(
  new URL('kitchen-sink.graphql', import.meta.url),
  'utf8',
);
