// node.js recommends this instead of using `node --loader ts-node/esm`
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('ts-node/esm', pathToFileURL('./'));
