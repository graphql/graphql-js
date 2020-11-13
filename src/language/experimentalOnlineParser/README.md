## Experimental Online Parser

This directory contains an experimental online parser based on JSON rules set. It is a state-full parser which parses a source string incrementally i.e. emits a token each time.

The parser is being migrated from graphiql to graphql-js and may have frequent breaking changes.

Example:

```js
import { OnlineParser } from 'graphql/language/experimentalOnlineParser';

const source = `
  query SomeQuery {
    some_field {
      another_field
    }
  }
`;

const parser = new OnlineParser(source);
let token;

do {
  token = parser.parseToken();
} while (token.kind !== '<EOF>' && token.kind !== 'Invalid');
```
