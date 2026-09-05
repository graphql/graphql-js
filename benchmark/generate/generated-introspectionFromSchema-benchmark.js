/* eslint-disable n/no-top-level-await */

import * as execution from 'graphql/execution/index.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';
import { getIntrospectionQuery } from 'graphql/utilities/getIntrospectionQuery.js';

import { bigSchemaSDL } from '../fixtures.js';

import { createGeneratedExecution } from './generatedExecution.js';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const document = parse(getIntrospectionQuery());

const generated = await createGeneratedExecution(
  execution,
  { schema, document },
  { schema },
  import.meta.url,
  'introspection-from-schema',
);
const compiled =
  generated ??
  (typeof execution.compileExecution === 'function'
    ? execution.compileExecution({ schema, document })
    : undefined);
if (Array.isArray(compiled)) {
  throw compiled[0];
}

export const benchmark = {
  name: 'Generated Execute Introspection Query',
  measure: () => {
    if (compiled !== undefined) {
      return 'execute' in compiled
        ? compiled.execute()
        : compiled.executeRootSelectionSet();
    }

    return execution.executeSync({ schema, document });
  },
};
