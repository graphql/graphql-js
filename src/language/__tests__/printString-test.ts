import { expect } from 'chai';
import { describe, it } from 'mocha';

import { printString } from '../printString';

describe('printString', () => {
  it('prints a simple string', () => {
    expect(printString('hello world')).to.equal('"hello world"');
  });

  it('escapes quotes', () => {
    expect(printString('"hello world"')).to.equal('"\\"hello world\\""');
  });

  it('does not escape single quote', () => {
    expect(printString("who's test")).to.equal('"who\'s test"');
  });

  it('escapes backslashes', () => {
    expect(printString('escape: \\')).to.equal('"escape: \\\\"');
  });

  it('escapes well-known control chars', () => {
    expect(printString('\b\f\n\r\t')).to.equal('"\\b\\f\\n\\r\\t"');
  });

  it('escapes zero byte', () => {
    expect(printString('\x00')).to.equal('"\\u0000"');
  });

  it('does not escape space', () => {
    expect(printString(' ')).to.equal('" "');
  });

  it('does not escape non-ascii character', () => {
    expect(printString('\u21BB')).to.equal('"\u21BB"');
  });

  it('does not escape supplementary character', () => {
    expect(printString('\u{1f600}')).to.equal('"\u{1f600}"');
  });

  it('escapes all control chars', () => {
    /* spellchecker:ignore abcdefghijklmnopqrstuvwxyz */
    expect(
      printString(
        '\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007' +
          '\u0008\u0009\u000A\u000B\u000C\u000D\u000E\u000F' +
          '\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017' +
          '\u0018\u0019\u001A\u001B\u001C\u001D\u001E\u001F' +
          '\u0020\u0021\u0022\u0023\u0024\u0025\u0026\u0027' +
          '\u0028\u0029\u002A\u002B\u002C\u002D\u002E\u002F' +
          '\u0030\u0031\u0032\u0033\u0034\u0035\u0036\u0037' +
          '\u0038\u0039\u003A\u003B\u003C\u003D\u003E\u003F' +
          '\u0040\u0041\u0042\u0043\u0044\u0045\u0046\u0047' +
          '\u0048\u0049\u004A\u004B\u004C\u004D\u004E\u004F' +
          '\u0050\u0051\u0052\u0053\u0054\u0055\u0056\u0057' +
          '\u0058\u0059\u005A\u005B\u005C\u005D\u005E\u005F' +
          '\u0060\u0061\u0062\u0063\u0064\u0065\u0066\u0067' +
          '\u0068\u0069\u006A\u006B\u006C\u006D\u006E\u006F' +
          '\u0070\u0071\u0072\u0073\u0074\u0075\u0076\u0077' +
          '\u0078\u0079\u007A\u007B\u007C\u007D\u007E\u007F' +
          '\u0080\u0081\u0082\u0083\u0084\u0085\u0086\u0087' +
          '\u0088\u0089\u008A\u008B\u008C\u008D\u008E\u008F' +
          '\u0090\u0091\u0092\u0093\u0094\u0095\u0096\u0097' +
          '\u0098\u0099\u009A\u009B\u009C\u009D\u009E\u009F',
      ),
    ).to.equal(
      '"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007' +
        '\\b\\t\\n\\u000B\\f\\r\\u000E\\u000F' +
        '\\u0010\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017' +
        '\\u0018\\u0019\\u001A\\u001B\\u001C\\u001D\\u001E\\u001F' +
        ' !\\"#$%&\'()*+,-./0123456789:;<=>?' +
        '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_' +
        '`abcdefghijklmnopqrstuvwxyz{|}~\\u007F' +
        '\\u0080\\u0081\\u0082\\u0083\\u0084\\u0085\\u0086\\u0087' +
        '\\u0088\\u0089\\u008A\\u008B\\u008C\\u008D\\u008E\\u008F' +
        '\\u0090\\u0091\\u0092\\u0093\\u0094\\u0095\\u0096\\u0097' +
        '\\u0098\\u0099\\u009A\\u009B\\u009C\\u009D\\u009E\\u009F"',
    );
  });
});
