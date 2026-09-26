import * as execution from 'graphql/execution/index.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

const fieldCount = 1000;
const fieldNames = Array.from(
  { length: fieldCount },
  (_, index) => `f${index}`,
);

const schema = buildSchema(
  `type Query { ${fieldNames.map((fieldName) => `${fieldName}: Int`).join(' ')} }`,
  { assumeValid: true },
);

const document = parse(`{ ${fieldNames.join(' ')} }`);

const rootValue = Object.fromEntries(
  fieldNames.map((fieldName, index) => [
    fieldName,
    () => Promise.resolve(index),
  ]),
);

const compiled =
  typeof execution.compileExecution === 'function'
    ? execution.compileExecution({ schema, document })
    : undefined;
if (Array.isArray(compiled)) {
  throw compiled[0];
}

export const benchmark = {
  name: 'Compiled Asynchronous Root Fields',
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
