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
    input FieldInput {
      enabled: Boolean
      value: Int
    }

    type Query {
      ${fieldNames
        .map(
          (fieldName) => `
            ${fieldName}(
              value: Int!
              enabled: Boolean
              input: FieldInput
              list: [Int]
            ): Int
          `,
        )
        .join('\n')}
    }
  `,
  { assumeValid: true },
);

const document = parse(`
  query GeneratedArgumentValues($value: Int!, $enabled: Boolean!) {
    ${fieldNames
      .map(
        (fieldName, index) => `
          ${fieldName}(
            value: $value
            enabled: $enabled
            input: { enabled: $enabled, value: ${index} }
            list: [${index}, $value]
          )
        `,
      )
      .join('\n')}
  }
`);

const rootValue = Object.fromEntries(
  fieldNames.map((fieldName, index) => [
    fieldName,
    (args) => args.value + args.input.value + args.list[0] + index,
  ]),
);

const generated = await createGeneratedExecution(
  execution,
  { schema, document },
  { schema },
  import.meta.url,
  'field-argument-values',
);
const compiled =
  generated ??
  (typeof execution.compileExecution === 'function'
    ? execution.compileExecution({ schema, document })
    : undefined);
if (Array.isArray(compiled)) {
  throw compiled[0];
}

let value = 0;
let enabled = false;

export const benchmark = {
  name: 'Generated Field Argument Values',
  measure: () => {
    value = (value + 1) % 10;
    enabled = !enabled;
    const runtimeArgs = {
      rootValue,
      variableValues: { value, enabled },
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
