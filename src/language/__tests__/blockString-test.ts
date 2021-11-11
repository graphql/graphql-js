import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedentBlockStringValue, printBlockString } from '../blockString';

function joinLines(...args: ReadonlyArray<string>) {
  return args.join('\n');
}

describe('dedentBlockStringValue', () => {
  function expectDedent(str: string) {
    return expect(dedentBlockStringValue(str));
  }

  it('handles empty string', () => {
    expectDedent('').to.equal('');
  });

  it('do not dedent first line', () => {
    expectDedent('  a').to.equal('  a');
    expectDedent(' a\n  b').to.equal(' a\nb');
  });

  it('removes minimal indentation length', () => {
    expectDedent('\n a\n  b').to.equal('a\n b');
    expectDedent('\n  a\n b').to.equal(' a\nb');
    expectDedent('\n  a\n b\nc').to.equal('  a\n b\nc');
  });

  it('dedent both tab and space as single character', () => {
    expectDedent('\n\ta\n          b').to.equal('a\n         b');
    expectDedent('\n\t a\n          b').to.equal('a\n        b');
    expectDedent('\n \t a\n          b').to.equal('a\n       b');
  });

  it('dedent do not take empty lines into account', () => {
    expectDedent('a\n\n b').to.equal('a\n\nb');
    expectDedent('a\n \n  b').to.equal('a\n\nb');
  });

  it('removes uniform indentation from a string', () => {
    const rawValue = joinLines(
      '',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
    );
    expectDedent(rawValue).to.equal(
      joinLines('Hello,', '  World!', '', 'Yours,', '  GraphQL.'),
    );
  });

  it('removes empty leading and trailing lines', () => {
    const rawValue = joinLines(
      '',
      '',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
      '',
      '',
    );
    expectDedent(rawValue).to.equal(
      joinLines('Hello,', '  World!', '', 'Yours,', '  GraphQL.'),
    );
  });

  it('removes blank leading and trailing lines', () => {
    const rawValue = joinLines(
      '  ',
      '        ',
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
      '        ',
      '  ',
    );
    expectDedent(rawValue).to.equal(
      joinLines('Hello,', '  World!', '', 'Yours,', '  GraphQL.'),
    );
  });

  it('retains indentation from first line', () => {
    const rawValue = joinLines(
      '    Hello,',
      '      World!',
      '',
      '    Yours,',
      '      GraphQL.',
    );
    expectDedent(rawValue).to.equal(
      joinLines('    Hello,', '  World!', '', 'Yours,', '  GraphQL.'),
    );
  });

  it('does not alter trailing spaces', () => {
    const rawValue = joinLines(
      '               ',
      '    Hello,     ',
      '      World!   ',
      '               ',
      '    Yours,     ',
      '      GraphQL. ',
      '               ',
    );
    expectDedent(rawValue).to.equal(
      joinLines(
        'Hello,     ',
        '  World!   ',
        '           ',
        'Yours,     ',
        '  GraphQL. ',
      ),
    );
  });
});

describe('printBlockString', () => {
  function expectBlockString(str: string, preferMultipleLines?: boolean) {
    return expect(printBlockString(str, preferMultipleLines));
  }

  it('do not escape characters', () => {
    const str = '" \\ / \b \f \n \r \t';
    expectBlockString(str).to.equal('"""\n' + str + '\n"""');
  });

  it('by default print block strings as single line', () => {
    const str = 'one liner';
    expectBlockString(str).to.equal('"""one liner"""');
    expectBlockString(str, true).to.equal('"""\none liner\n"""');
    expectBlockString(str, false).to.equal('"""one liner"""');
  });

  it('by default print block strings ending with triple quotation as multi-line', () => {
    const str = 'triple quotation """';
    expectBlockString(str).to.equal('"""\ntriple quotation \\"""\n"""');
    expectBlockString(str, true).to.equal('"""\ntriple quotation \\"""\n"""');
    expectBlockString(str, false).to.equal('"""triple quotation \\""""""');
  });

  it('correctly prints single-line with leading space', () => {
    const str = '    space-led string';
    expectBlockString(str).to.equal('"""    space-led string"""');
    expectBlockString(str, true).to.equal('"""    space-led string\n"""');
    expectBlockString(str, false).to.equal('"""    space-led string"""');
  });

  it('correctly prints single-line with leading space and trailing quotation', () => {
    const str = '    space-led value "quoted string"';

    expectBlockString(str).to.equal(
      '"""    space-led value "quoted string"\n"""',
    );

    expectBlockString(str, true).to.equal(
      '"""    space-led value "quoted string"\n"""',
    );

    expectBlockString(str, false).to.equal(
      '"""    space-led value "quoted string"\n"""',
    );
  });

  it('correctly prints single-line with trailing backslash', () => {
    const str = 'backslash \\';

    expectBlockString(str).to.equal('"""\nbackslash \\\n"""');
    expectBlockString(str, true).to.equal('"""\nbackslash \\\n"""');
    expectBlockString(str, false).to.equal('"""backslash \\\n"""');
  });

  it('correctly prints multi-line with internal indent', () => {
    const str = 'no indent\n with indent';

    expectBlockString(str).to.equal('"""\nno indent\n with indent\n"""');
    expectBlockString(str, true).to.equal('"""\nno indent\n with indent\n"""');
    expectBlockString(str, false).to.equal('"""\nno indent\n with indent"""');
  });

  it('correctly prints string with a first line indentation', () => {
    const str = joinLines(
      '    first  ',
      '  line     ',
      'indentation',
      '     string',
    );

    expectBlockString(str).to.equal(
      joinLines(
        '"""',
        '    first  ',
        '  line     ',
        'indentation',
        '     string',
        '"""',
      ),
    );
  });
});
