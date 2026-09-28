import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import type { GraphQLError } from '../../../error/GraphQLError.ts';

import { parse } from '../../../language/parser.ts';

import { validate } from '../../../validation/validate.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { experimentalExecuteIncrementally } from '../../execute.ts';
import { legacyExecuteIncrementally } from '../../legacyIncremental/legacyExecuteIncrementally.ts';

const schema = buildSchema(`
  directive @defer(if: Boolean! = true, label: String)
    on FRAGMENT_SPREAD | INLINE_FRAGMENT
  directive @stream(if: Boolean! = true, label: String, initialCount: Int! = 0)
    on FIELD
  type Query { nullable: String, required: String!, users: [User!] }
  type User { nullable: String, required: String! }
`);

describe('Execute: collected errors before incremental failure', () => {
  for (const execute of [
    experimentalExecuteIncrementally,
    legacyExecuteIncrementally,
  ]) {
    describe(execute.name, () => {
      for (const mode of ['sync', 'async', 'promised item']) {
        for (const stream of [false, true]) {
          if (!stream && mode === 'promised item') {
            continue;
          }
          it(`preserves the collected nullable error (${stream ? 'stream' : 'defer'}, ${mode})`, async () => {
            const document = parse(
              stream
                ? '{ users @stream(initialCount: 0) { nullable required } }'
                : '{ ... @defer { nullable required } }',
            );
            expect(validate(schema, document)).to.deep.equal([]);
            let nullableExecuted = false;
            const source = {
              nullable() {
                nullableExecuted = true;
                throw new Error('nullable failed');
              },
              required() {
                expect(nullableExecuted).to.equal(true);
                return mode === 'async' ? Promise.resolve(null) : null;
              },
            };
            const result = await execute({
              schema,
              document,
              rootValue: stream
                ? {
                    users: [
                      mode === 'promised item'
                        ? Promise.resolve(source)
                        : source,
                    ],
                  }
                : source,
            });
            assert('initialResult' in result);
            const errors: Array<GraphQLError> = [];
            for await (const update of result.subsequentResults) {
              for (const entry of update.incremental ?? []) {
                errors.push(...(entry.errors ?? []));
              }
              if ('completed' in update) {
                for (const entry of update.completed ?? []) {
                  errors.push(...(entry.errors ?? []));
                }
              }
            }
            expect(nullableExecuted).to.equal(true);
            const prefix = stream ? ['users', 0] : [];
            expect(errors.map((error) => error.path)).to.deep.equal([
              [...prefix, 'nullable'],
              [...prefix, 'required'],
            ]);
          });
        }
      }
    });
  }
});
