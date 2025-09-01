import assert from 'node:assert';

import { GraphQLObjectType as ESMGraphQLObjectType } from 'graphql';

import { CJSGraphQLObjectType, cjsPath } from './cjs-importer.cjs';

const moduleSync = process.env.MODULE_SYNC === 'true';
const expectedExtension = moduleSync ? '.mjs' : '.js';
assert.ok(
  cjsPath.endsWith(expectedExtension),
  `require('graphql') should resolve to a file with extension "${expectedExtension}", but got "${cjsPath}".`,
);

const isSameModule = ESMGraphQLObjectType === CJSGraphQLObjectType;
assert.strictEqual(
  isSameModule,
  true,
  'ESM and CJS imports should be the same module instances.',
);

console.log('Module identity and path checks passed.');
