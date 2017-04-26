/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import EventEmitter from 'events';
import eventEmitterAsyncIterator from './eventEmitterAsyncIterator';
import {subscribe} from '../subscribe';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLString,
} from '../../type';


describe('Subscribe', () => {

  const EmailType = new GraphQLObjectType({
    name: 'Email',
    fields: {
      from: { type: GraphQLString },
      subject: { type: GraphQLString },
      message: { type: GraphQLString },
      unread: { type: GraphQLBoolean },
    }
  });

  const InboxType = new GraphQLObjectType({
    name: 'Inbox',
    fields: {
      total: {
        type: GraphQLInt,
        resolve: inbox => inbox.emails.length,
      },
      unread: {
        type: GraphQLInt,
        resolve: inbox => inbox.emails.filter(email => email.unread).length,
      },
      emails: { type: new GraphQLList(EmailType) },
    }
  });

  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      inbox: { type: InboxType },
    }
  });

  const EmailEventType = new GraphQLObjectType({
    name: 'EmailEvent',
    fields: {
      email: { type: EmailType },
      inbox: { type: InboxType },
    }
  });

  const SubscriptionType = new GraphQLObjectType({
    name: 'Subscription',
    fields: {
      importantEmail: { type: EmailEventType },
    }
  });

  const emailSchema = new GraphQLSchema({
    query: QueryType,
    subscription: SubscriptionType
  });

  it('produces a payload per subscription event', async () => {

    const pubsub = new EventEmitter();

    const data = {
      inbox: {
        emails: [
          {
            from: 'joe@graphql.org',
            subject: 'Hello',
            message: 'Hello World',
            unread: false,
          },
        ],
      },
      importantEmail() {
        return eventEmitterAsyncIterator(pubsub, 'importantEmail');
      }
    };

    function sendImportantEmail(newEmail) {
      data.inbox.emails.push(newEmail);
      // Returns true if the event was consumed by a subscriber.
      return pubsub.emit('importantEmail', {
        importantEmail: {
          email: newEmail,
          inbox: data.inbox,
        }
      });
    }

    const ast = parse(`
      subscription ($priority: Int = 0) {
        importantEmail(priority: $priority) {
          email {
            from
            subject
          }
          inbox {
            unread
            total
          }
        }
      }
    `);

    // GraphQL `subscribe` has the same call signature as `execute`, but returns
    // AsyncIterator instead of Promise.
    const subscription = subscribe(
      emailSchema,
      ast,
      data,
      null, // context
      { priority: 1 }
    );

    // Wait for the next subscription payload.
    const payload = subscription.next();

    // A new email arrives!
    expect(sendImportantEmail({
      from: 'yuzhi@graphql.org',
      subject: 'Alright',
      message: 'Tests are good',
      unread: true,
    })).to.equal(true);

    // The previously waited on payload now has a value.
    expect(await payload).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'yuzhi@graphql.org',
              subject: 'Alright',
            },
            inbox: {
              unread: 1,
              total: 2,
            },
          },
        },
      },
    });

    // Another new email arrives, before subscription.next() is called.
    expect(sendImportantEmail({
      from: 'hyo@graphql.org',
      subject: 'Tools',
      message: 'I <3 making things',
      unread: true,
    })).to.equal(true);

    // The next waited on payload will have a value.
    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'hyo@graphql.org',
              subject: 'Tools',
            },
            inbox: {
              unread: 2,
              total: 3,
            },
          },
        },
      },
    });

    // The client decides to disconnect.
    expect(await subscription.return()).to.deep.equal({
      done: true,
      value: undefined,
    });

    // Which may result in disconnecting upstream services as well.
    expect(sendImportantEmail({
      from: 'adam@graphql.org',
      subject: 'Important',
      message: 'Read me please',
      unread: true,
    })).to.equal(false); // No more listeners.

    // Awaiting a subscription after closing it results in completed results.
    expect(await subscription.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

});
