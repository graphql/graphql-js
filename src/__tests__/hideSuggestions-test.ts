// cspell:ignore colr greetingg

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../language/parser';

import { executeSync } from '../execution/execute';
import { subscribe } from '../execution/subscribe';

import { buildSchema } from '../utilities/buildASTSchema';

import { graphqlSync } from '../graphql';

describe('hideSuggestions', () => {
  const schema = buildSchema(`
    type Subscription { search(filter: Filter): String }
    enum Color { RED GREEN BLUE }
    input Filter { color: Color }
    type Query {
      greeting(name: String): String
      search(filter: Filter): String
    }
  `);

  it('forwards the option through subscription variable coercion', async () => {
    const document = parse(
      'subscription ($filter: Filter) { search(filter: $filter) }',
    );
    await Promise.all(
      [false, true].map(async (hideSuggestions) => {
        const result = await subscribe({
          schema,
          document,
          variableValues: { filter: { color: 'REDD', colr: 'RED' } },
          hideSuggestions,
        });
        if (!('errors' in result)) {
          throw new Error('Expected coercion errors.');
        }
        expect(result.errors?.length).to.equal(2);
        for (const error of result.errors ?? []) {
          expect(error.message.includes('Did you mean')).to.equal(
            !hideSuggestions,
          );
        }
      }),
    );
  });

  it('omits validation suggestions while preserving errors', () => {
    for (const source of [
      '{ greetingg }',
      'query ($value: Colr) { greeting }',
      '{ greeting(nam: "x") }',
      '{ greeting @skip(iff: true) }',
      '{ search(filter: { colr: RED }) }',
      '{ search(filter: { color: REDD }) }',
    ]) {
      const visible = graphqlSync({ schema, source });
      const hidden = graphqlSync({ schema, source, hideSuggestions: true });
      const visibleMessages =
        visible.errors?.map((error) => error.message) ?? [];
      const hiddenMessages = hidden.errors?.map((error) => error.message) ?? [];
      expect(
        visibleMessages.some((message) => message.includes('Did you mean')),
      ).to.equal(true);
      expect(hiddenMessages.length).to.equal(visibleMessages.length);
      expect(
        hiddenMessages.every((message) => !message.includes('Did you mean')),
      ).to.equal(true);
      expect(
        graphqlSync({ schema, source, hideSuggestions: false }),
      ).to.deep.equal(visible);
    }
  });

  it('forwards the option through graphql and direct execution variable coercion', () => {
    const source = 'query ($filter: Filter) { search(filter: $filter) }';
    const document = parse(source);
    const variableValues = { filter: { color: 'REDD', colr: 'RED' } };
    for (const hideSuggestions of [false, true]) {
      const fromGraphql = graphqlSync({
        schema,
        source,
        variableValues,
        hideSuggestions,
      });
      const fromExecute = executeSync({
        schema,
        document,
        variableValues,
        hideSuggestions,
      });
      expect(fromExecute.errors?.map((error) => error.message)).to.deep.equal(
        fromGraphql.errors?.map((error) => error.message),
      );
      expect(fromExecute.errors?.length).to.equal(2);
      for (const error of fromExecute.errors ?? []) {
        expect(error.message.includes('Did you mean')).to.equal(
          !hideSuggestions,
        );
      }
    }
  });
});
