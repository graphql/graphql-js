import { expect } from 'chai';
import { describe, it } from 'mocha';
import { executeReactive } from '../execute';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
} from '../../type';
import {
  Observable
} from 'rxjs';

describe('Execute: Handles Observables from resolvers', () => {
  it('uses the named operation if operation name is provided', async () => {
    const doc = 'query Example { first: a }';
    const data = { a: Observable.of('b') };
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        }
      })
    });

    const result = await executeReactive(schema, parse(doc), data).toPromise();

    expect(result).to.deep.equal({ data: { first: 'b' } });
  });

  it('does not query reactive', () => {
    const doc = 'query Example { first: a }';
    const data = { a: Observable.interval(5) };
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Type',
        fields: {
          a: { type: GraphQLString },
        }
      })
    });

    return executeReactive(schema, parse(doc), data).take(2).map(result => {
      expect(result).to.deep.equal({ data: { first: '0' } });
    }).toPromise();
  });

  it('does query reactive for subscriptions', () => {
    const doc = 'subscription Example { first: a }';
    const data = { a: Observable.interval(5) };
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'QueryType',
        fields: {
          b: { type: GraphQLString },
        }
      }),

      subscription: new GraphQLObjectType({
        name: 'SubscriptionType',
        fields: {
          a: { type: GraphQLString },
        }
      })
    });
    let counter = 0;

    return executeReactive(schema, parse(doc), data).take(5).do(result => {
      expect(result).to.deep.equal({ data: { first: counter.toString() } });
      counter++;
    }).toPromise().then(fresult => {
      // Subscription should return 5 values ( 0...4 ) because of take(5).
      // counter should be equal to 5 since
      // it's being incremeanted after the last expect.
      expect(fresult).to.deep.equal({ data: { first: '4' } });
      expect(counter).to.be.equal(5);
    });
  });

});
