/* eslint-disable n/no-top-level-await */

import * as execution from 'graphql/execution/index.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

import { createGeneratedExecution } from './generatedExecution.js';

const fieldCount = 100;
const fieldNames = Array.from(
  { length: fieldCount },
  (_, index) => `f${index}`,
);

const schema = buildSchema(
  `
    type Query {
      item: Item!
    }

    type Item {
      ${fieldNames.map((fieldName) => `${fieldName}: Int`).join('\n')}
      nested: Item
    }
  `,
  { assumeValid: true },
);

const repeatedFields = fieldNames
  .map(
    (fieldName, index) =>
      `${fieldName} @${index % 2 === 0 ? 'include' : 'skip'}(if: $flag)`,
  )
  .join('\n');

const document = parse(`
  query GeneratedExecute($flag: Boolean!) {
    item {
      ...ItemFields
      ... on Item {
        ${repeatedFields}
      }
      nested {
        ...ItemFields
      }
    }
  }

  fragment ItemFields on Item {
    ${repeatedFields}
  }
`);

const item = Object.fromEntries(
  fieldNames.map((fieldName, index) => [fieldName, index]),
);
item.nested = item;

const generated = await createGeneratedExecution(
  execution,
  { schema, document },
  { schema },
  import.meta.url,
  'variable-field-collection',
);
const compiled =
  generated ??
  (typeof execution.compileExecution === 'function'
    ? execution.compileExecution({ schema, document })
    : undefined);
if (Array.isArray(compiled)) {
  throw compiled[0];
}

let flag = false;

export const benchmark = {
  name: 'Generated Variable Field Collection',
  measure: () => {
    flag = !flag;
    const runtimeArgs = {
      rootValue: { item },
      variableValues: { flag },
    };
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
