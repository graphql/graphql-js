import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';
import { validate } from 'graphql/validation/validate.js';

const subscriptionSchemaSDL = `
  type Email {
    from: String
    subject: String
    asyncSubject: String
    unread: Boolean
  }

  type Inbox {
    total: Int
    unread: Int
    emails: [Email]
  }

  type Query {
    inbox: Inbox
  }

  type EmailEvent {
    email: Email
    inbox: Inbox
  }

  type Subscription {
    importantEmail(priority: Int): EmailEvent
  }
`;

const schema = buildSchema(subscriptionSchemaSDL, { assumeValid: true });

const operationAST = parse(`
  subscription (
    $priority: Int = 0
    $shouldDefer: Boolean = false
    $shouldStream: Boolean = false
    $asyncResolver: Boolean = false
  ) {
    importantEmail(priority: $priority) {
      email {
        from
        subject
        ... @include(if: $asyncResolver) {
          asyncSubject
        }
      }
      ... @defer(if: $shouldDefer) {
        inbox {
          emails @include(if: $shouldStream) @stream(if: $shouldStream)
          unread
          total
        }
      }
    }
  }
`);

export const benchmark = {
  name: 'Validate Subscription Operation',
  count: 50,
  measure() {
    validate(schema, operationAST);
  },
};
