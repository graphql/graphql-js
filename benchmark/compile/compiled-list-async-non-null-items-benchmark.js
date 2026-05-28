import * as execution from 'graphql/execution/index.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

const schema = buildSchema('type Query { listField: [String!] }', {
  assumeValid: true,
});
const document = parse('{ listField }');

function listField() {
  const results = [];
  for (let index = 0; index < 1000; index++) {
    results.push(Promise.resolve(index));
  }
  return results;
}

const rootValue = { listField };

const compiled =
  typeof execution.compileExecution === 'function'
    ? execution.compileExecution({ schema, document })
    : undefined;
if (Array.isArray(compiled)) {
  throw compiled[0];
}

export const benchmark = {
  name: 'Compiled Asynchronous Non-Null List Items',
  measure: () => {
    const runtimeArgs = { rootValue };
    if (compiled !== undefined) {
      return 'execute' in compiled
        ? compiled.execute(runtimeArgs)
        : compiled.executeRootSelectionSet(runtimeArgs);
    }

    const validatedArgs = execution.validateExecutionArgs({
      schema,
      document,
      ...runtimeArgs,
    });
    if (!('schema' in validatedArgs)) {
      throw validatedArgs[0];
    }
    return execution.executeRootSelectionSet(validatedArgs);
  },
};
