import assert from 'node:assert';

import {
  GraphQLObjectType as ESMGraphQLObjectType,
  GraphQLString as ESMGraphQLString,
  isCompositeType as ESMIsCompositeType,
} from 'graphql';
import {
  GraphQLObjectType as ESMTypeGraphQLObjectType,
  GraphQLString as ESMTypeGraphQLString,
  isCompositeType as ESMTypeIsCompositeType,
} from 'graphql/type';

import {
  CJSGraphQLObjectType,
  CJSGraphQLString,
  CJSIsCompositeType,
  cjsPath,
  CJSTypeGraphQLObjectType,
  CJSTypeGraphQLString,
  CJSTypeIsCompositeType,
  cjsTypePath,
} from './cjs-importer.cjs';

const moduleSync = process.env.MODULE_SYNC === 'true';
const expectedExtension = moduleSync ? '.mjs' : '.js';
const resolvedPaths = [
  ["require('graphql')", cjsPath],
  ["require('graphql/type')", cjsTypePath],
];

for (const [specifier, resolvedPath] of resolvedPaths) {
  assert.ok(
    resolvedPath.endsWith(expectedExtension),
    `${specifier} should resolve to a file with extension "${expectedExtension}", but got "${resolvedPath}".`,
  );
}

const isSameModule = ESMGraphQLObjectType === CJSGraphQLObjectType;
assert.strictEqual(
  isSameModule,
  true,
  'ESM and CJS imports should be the same module instances.',
);

assert.strictEqual(
  ESMGraphQLObjectType,
  ESMTypeGraphQLObjectType,
  'Root and graphql/type ESM imports should use the same GraphQLObjectType instance.',
);
assert.strictEqual(
  CJSGraphQLObjectType,
  CJSTypeGraphQLObjectType,
  'Root and graphql/type CJS imports should use the same GraphQLObjectType instance.',
);
assert.strictEqual(
  ESMIsCompositeType,
  ESMTypeIsCompositeType,
  'Root and graphql/type ESM imports should use the same isCompositeType predicate.',
);
assert.strictEqual(
  CJSIsCompositeType,
  CJSTypeIsCompositeType,
  'Root and graphql/type CJS imports should use the same isCompositeType predicate.',
);
assert.strictEqual(
  ESMIsCompositeType,
  CJSIsCompositeType,
  'ESM and CJS imports should use the same isCompositeType predicate.',
);
assert.strictEqual(
  ESMGraphQLString,
  ESMTypeGraphQLString,
  'Root and graphql/type ESM imports should use the same GraphQLString instance.',
);
assert.strictEqual(
  CJSGraphQLString,
  CJSTypeGraphQLString,
  'Root and graphql/type CJS imports should use the same GraphQLString instance.',
);

const objectTypes = [
  [
    'ESM root GraphQLObjectType',
    new ESMGraphQLObjectType({
      name: 'ESMRootObjectType',
      fields: { field: { type: ESMGraphQLString } },
    }),
  ],
  [
    'ESM graphql/type GraphQLObjectType',
    new ESMTypeGraphQLObjectType({
      name: 'ESMTypeObjectType',
      fields: { field: { type: ESMTypeGraphQLString } },
    }),
  ],
  [
    'CJS root GraphQLObjectType',
    new CJSGraphQLObjectType({
      name: 'CJSRootObjectType',
      fields: { field: { type: CJSGraphQLString } },
    }),
  ],
  [
    'CJS graphql/type GraphQLObjectType',
    new CJSTypeGraphQLObjectType({
      name: 'CJSTypeObjectType',
      fields: { field: { type: CJSTypeGraphQLString } },
    }),
  ],
];

const predicates = [
  ['ESM root isCompositeType', ESMIsCompositeType],
  ['ESM graphql/type isCompositeType', ESMTypeIsCompositeType],
  ['CJS root isCompositeType', CJSIsCompositeType],
  ['CJS graphql/type isCompositeType', CJSTypeIsCompositeType],
];

for (const [objectTypeLabel, objectType] of objectTypes) {
  for (const [predicateLabel, isCompositeType] of predicates) {
    assert.strictEqual(
      isCompositeType(objectType),
      true,
      `${predicateLabel} should return true for ${objectTypeLabel}.`,
    );
  }
}

console.log('Module identity, subpath identity, and path checks passed.');
