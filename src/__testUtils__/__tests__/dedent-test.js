import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent, dedentString } from '../dedent';

describe('dedentString', () => {
  it('removes indentation in typical usage', () => {
    const output = dedentString(`
      type Query {
        me: User
      }

      type User {
        id: ID
        name: String
      }
    `);
    expect(output).to.equal(
      [
        'type Query {',
        '  me: User',
        '}',
        '',
        'type User {',
        '  id: ID',
        '  name: String',
        '}',
      ].join('\n'),
    );
  });

  it('removes only the first level of indentation', () => {
    const output = dedentString(`
            first
              second
                third
                  fourth
    `);
    expect(output).to.equal(
      ['first', '  second', '    third', '      fourth'].join('\n'),
    );
  });

  it('does not escape special characters', () => {
    const output = dedentString(`
      type Root {
        field(arg: String = "wi\th de\fault"): String
      }
    `);
    expect(output).to.equal(
      [
        'type Root {',
        '  field(arg: String = "wi\th de\fault"): String',
        '}',
      ].join('\n'),
    );
  });

  it('also removes indentation using tabs', () => {
    const output = dedentString(`
        \t\t    type Query {
        \t\t      me: User
        \t\t    }
    `);
    expect(output).to.equal(['type Query {', '  me: User', '}'].join('\n'));
  });

  it('removes leading and trailing newlines', () => {
    const output = dedentString(`


      type Query {
        me: User
      }


    `);
    expect(output).to.equal(['type Query {', '  me: User', '}'].join('\n'));
  });

  it('removes all trailing spaces and tabs', () => {
    const output = dedentString(`
      type Query {
        me: User
      }
          \t\t  \t `);
    expect(output).to.equal(['type Query {', '  me: User', '}'].join('\n'));
  });

  it('works on text without leading newline', () => {
    const output = dedentString(`      type Query {
        me: User
      }
    `);
    expect(output).to.equal(['type Query {', '  me: User', '}'].join('\n'));
  });
});

describe('dedent', () => {
  it('removes indentation in typical usage', () => {
    const output = dedent`
      type Query {
        me: User
      }
    `;
    expect(output).to.equal(['type Query {', '  me: User', '}'].join('\n'));
  });

  it('supports expression interpolation', () => {
    const name = 'John';
    const surname = 'Doe';
    const output = dedent`
      {
        "me": {
          "name": "${name}",
          "surname": "${surname}"
        }
      }
    `;
    expect(output).to.equal(
      [
        '{',
        '  "me": {',
        '    "name": "John",',
        '    "surname": "Doe"',
        '  }',
        '}',
      ].join('\n'),
    );
  });
});
