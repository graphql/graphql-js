import * as execution from 'graphql/execution/index.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';
import { getIntrospectionQuery } from 'graphql/utilities/getIntrospectionQuery.js';

import { bigSchemaSDL } from '../fixtures.js';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const document = parse(getIntrospectionQuery());

const compiled =
  typeof execution.compileExecution === 'function'
    ? execution.compileExecution({ schema, document })
    : undefined;
if (Array.isArray(compiled)) {
  throw compiled[0];
}

export const benchmark = {
  name: 'Compiled Execute Introspection Query',
  measure: () => {
    if (compiled !== undefined) {
      return 'execute' in compiled
        ? compiled.execute()
        : compiled.executeRootSelectionSet();
    }

    return execution.executeSync({ schema, document });
  },
};
