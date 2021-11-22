import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedentBlockStringLines, printBlockString } from '../blockString';

function joinLines(...args: ReadonlyArray<string>) {
  return args.join('\n');
}

describe('dedentBlockStringLines', () => {
  function expectDedent(lines: ReadonlyArray<string>) {
    return expect(dedentBlockStringLines(lines));
  }

  it('handles empty string', () => {
    expectDedent(['']).to.deep.equal([]);
  });

  it('do not dedent first line', () => {
    expectDedent(['  a']).to.deep.equal(['  a']);
    expectDedent([' a', '  b']).to.deep.equal([' a', 'b']);
  });

  it('removes minimal indentation length', () => {
    expectDedent(['', ' a', '  b']).to.deep.equal(['a', ' b']);
    expectDedent(['', '  a', ' b']).to.deep.equal([' a', 'b']);
    expectDedent(['', '  a', ' b', 'c']).to.deep.equal(['  a', ' b', 'c']);
  });

  it('dedent both tab and space as single character', () => {
    expectDedent(['', '\ta', '          b']).to.deep.equal(['a', '         b']);
    expectDedent(['', '\t a', '          b']).to.deep.equal(['a', '        b']);
    expectDedent(['', ' \t a', '          b']).to.deep.equal(['a', '       b']);
  });

  it('dedent do not take empty lines into account', () => {
    expectDedent(['a', '', ' b']).to.deep.equal(['a', '', 'b']);
    expectDedent(['a', ' ', '  b']).to.deep.equal(['a', '', 'b']);
  });

  it('removes uniform indentation from a string', () => {
    const lines = [
      '',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
    ];
    expectDedent(lines).to.deep.equal([
      'Hello,',
      '  World!',
      '',
      'Yours,',
      '  GraphQL.',
    ]);
  });

  it('removes empty leading and trailing lines', () => {
    const lines = [
      '',
      '',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
      '',
      '',
    ];
    expectDedent(lines).to.deep.equal([
      'Hello,',
      '  World!',
      '',
      'Yours,',
      '  GraphQL.',
    ]);
  });

  it('removes blank leading and trailing lines', () => {
    const lines = [
      '  ',
      '        ',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
      '        ',
      '  ',
    ];
    expectDedent(lines).to.deep.equal([
      'Hello,',
      '  World!',
      '',
      'Yours,',
      '  GraphQL.',
    ]);
  });

  it('retains indentation from first line', () => {
    const lines = [
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
    ];
    expectDedent(lines).to.deep.equal([
      '    Hello,',
      '  World!',
      '',
      'Yours,',
      '  GraphQL.',
    ]);
  });

  it('does not alter trailing spaces', () => {
    const lines = [
      '               ',
      '    Hello,     ',
      '      World!   ',
      '               ',
      '    Yours,     ',
      '      GraphQL. ',
      '               ',
    ];
    expectDedent(lines).to.deep.equal([
      'Hello,     ',
      '  World!   ',
      '           ',
      'Yours,     ',
      '  GraphQL. ',
    ]);
  });
});

describe('printBlockString', () => {
  function expectBlockString(str: string) {
    return {
      toEqual(expected: string | { readable: string; minimize: string }) {
        const { readable, minimize } =
          typeof expected === 'string'
            ? { readable: expected, minimize: expected }
            : expected;

        expect(printBlockString(str)).to.equal(readable);
        expect(printBlockString(str, { minimize: true })).to.equal(minimize);
      },
    };
  }

  it('do not escape characters', () => {
    const str = '" \\ / \b \f \n \r \t';
    expectBlockString(str).toEqual({
      readable: '"""\n' + str + '\n"""',
      minimize: '"""\n' + str + '"""',
    });
  });

  it('by default print block strings as single line', () => {
    const str = 'one liner';
    expectBlockString(str).toEqual('"""one liner"""');
  });

  it('by default print block strings ending with triple quotation as multi-line', () => {
    const str = 'triple quotation """';
    expectBlockString(str).toEqual({
      readable: '"""\ntriple quotation \\"""\n"""',
      minimize: '"""triple quotation \\""""""',
    });
  });

  it('correctly prints single-line with leading space', () => {
    const str = '    space-led string';
    expectBlockString(str).toEqual('"""    space-led string"""');
  });

  it('correctly prints single-line with leading space and trailing quotation', () => {
    const str = '    space-led value "quoted string"';
    expectBlockString(str).toEqual(
      '"""    space-led value "quoted string"\n"""',
    );
  });

  it('correctly prints single-line with trailing backslash', () => {
    const str = 'backslash \\';
    expectBlockString(str).toEqual({
      readable: '"""\nbackslash \\\n"""',
      minimize: '"""backslash \\\n"""',
    });
  });

  it('correctly prints multi-line with internal indent', () => {
    const str = 'no indent\n with indent';
    expectBlockString(str).toEqual({
      readable: '"""\nno indent\n with indent\n"""',
      minimize: '"""\nno indent\n with indent"""',
    });
  });

  it('correctly prints string with a first line indentation', () => {
    const str = joinLines(
      '    first  ',
      '  line     ',
      'indentation',
      '     string',
    );

    expectBlockString(str).toEqual({
      readable: joinLines(
        '"""',
        '    first  ',
        '  line     ',
        'indentation',
        '     string',
        '"""',
      ),
      minimize: joinLines(
        '"""    first  ',
        '  line     ',
        'indentation',
        '     string"""',
      ),
    });
  });
});
