'use strict';

const fs = require('fs');
const path = require('path');

exports.bigSchemaSDL = fs.readFileSync(
  path.join(__dirname, 'github-schema.graphql'),
  'utf8',
);

exports.bigSchemaIntrospectionResult = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'github-schema.json'), 'utf8'),
);
