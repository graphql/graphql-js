/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import dedent from '../dedent';

describe('dedent', () => {
  it('removes indentation in typical usage', () => {
    expect(dedent`
      type Query {
        me: User
      }
      
      type User {
        id: ID
        name: String
      }
      `).to.equal(
      'type Query {\n  me: User\n}\n\n' +
        'type User {\n  id: ID\n  name: String\n}\n',
    );
  });

  it('removes only the first level of indentation', () => {
    expect(dedent`
            qux
              quux
                quuux
                  quuuux
      `).to.equal('qux\n  quux\n    quuux\n      quuuux\n');
  });

  it('does not escape special characters', () => {
    expect(dedent`
      type Root {
        field(arg: String = "wi\th de\fault"): String
      }
      `).to.equal(
      'type Root {\n  field(arg: String = "wi\th de\fault"): String\n}\n',
    );
  });

  it('also works as an ordinary function on strings', () => {
    expect(
      dedent(`
      type Query {
        me: User
      }
      `),
    ).to.equal('type Query {\n  me: User\n}\n');
  });

  it('also removes indentation using tabs', () => {
    expect(dedent`
        \t\t    type Query {
        \t\t      me: User
        \t\t    }
      `).to.equal('type Query {\n  me: User\n}\n');
  });

  it('removes leading newlines', () => {
    expect(dedent`


      type Query {
        me: User
      }`).to.equal('type Query {\n  me: User\n}');
  });

  it('does not remove trailing newlines', () => {
    expect(dedent`
      type Query {
        me: User
      }

      `).to.equal('type Query {\n  me: User\n}\n\n');
  });

  it('removes all trailing spaces and tabs', () => {
    expect(dedent`
      type Query {
        me: User
      }
          \t\t  \t `).to.equal('type Query {\n  me: User\n}\n');
  });

  it('works on text without leading newline', () => {
    expect(dedent`      type Query {
        me: User
      }`).to.equal('type Query {\n  me: User\n}');
  });
});
