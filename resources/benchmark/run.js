'use strict';

/*
const fs = require('fs');
function readJson(filename) {
  const data = fs.readFileSync(filename);
  return JSON.parse(data);
}
const json = readJson('resources/benchmark/github-schema.json');
import { buildClientSchema } from '../../src/';
const schema = buildClientSchema(json.data);
import { printSchema } from '../../src/';
const schemaText = printSchema(schema);
console.log(schemaText);
*/

const fs = require('fs');
import { buildSchema } from '../../src/';
function readSchema(filename) {
  const data = fs.readFileSync(filename, 'utf8');
  return buildSchema(data);
}
const schema = readSchema('resources/benchmark/github-schema.graphql');
import { graphqlSync, getIntrospectionQuery } from '../../src/';

import Benchmark from 'benchmark';
const suite = new Benchmark.Suite;

suite.add('introspectionQuery', () =>
  graphqlSync(schema, getIntrospectionQuery())
)
.on('cycle', event => console.log(String(event.target)))
.run({ 'async': true });
