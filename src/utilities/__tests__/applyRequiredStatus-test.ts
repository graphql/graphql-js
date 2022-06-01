import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Parser, parseType } from '../../language/parser';
import { TokenKind } from '../../language/tokenKind';

import { assertOutputType } from '../../type/definition';
import { GraphQLInt } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { applyRequiredStatus } from '../applyRequiredStatus';
import { typeFromAST } from '../typeFromAST';

function applyRequiredStatusTest(
  typeStr: string,
  nullabilityStr: string,
): string {
  const schema = new GraphQLSchema({ types: [GraphQLInt] });
  const type = assertOutputType(typeFromAST(schema, parseType(typeStr)));

  const parser = new Parser(nullabilityStr, {
    experimentalClientControlledNullability: true,
  });

  parser.expectToken(TokenKind.SOF);
  const nullabilityNode = parser.parseNullabilityModifier();
  parser.expectToken(TokenKind.EOF);

  const outputType = applyRequiredStatus(type, nullabilityNode);
  return outputType.toString();
}

describe('applyRequiredStatus', () => {
  it('applyRequiredStatus smoke test', () => {
    expect(applyRequiredStatusTest('Int', '')).to.equal('Int');
  });

  it('applyRequiredStatus produces correct output types with no overrides', () => {
    expect(applyRequiredStatusTest('[[[Int!]]!]!', '[[[]]]')).to.equal(
      '[[[Int!]]!]!',
    );
  });

  it('applyRequiredStatus produces correct output types with required overrides', () => {
    expect(applyRequiredStatusTest('[[[Int!]]!]!', '[[[!]!]!]!')).to.equal(
      '[[[Int!]!]!]!',
    );
  });

  it('applyRequiredStatus produces correct output types with optional overrides', () => {
    expect(applyRequiredStatusTest('[[[Int!]]!]!', '[[[?]?]?]?')).to.equal(
      '[[[Int]]]',
    );
  });

  it('applyRequiredStatus throws error when modifier is too deep', () => {
    expect(() => {
      applyRequiredStatusTest('[[[Int!]]!]!', '[[[[]]]]');
    }).to.throw('List nullability modifier is too deep.');
  });

  it('applyRequiredStatus throws error when modifier is too shallow', () => {
    expect(() => {
      applyRequiredStatusTest('[[[Int!]]!]!', '[[]]');
    }).to.throw('List nullability modifier is too shallow.');
  });

  it('applyRequiredStatus with required designator functions when list syntax is excluded', () => {
    expect(applyRequiredStatusTest('[[[Int!]]!]', '!')).to.equal(
      '[[[Int!]]!]!'
    );
  });

  it('applyRequiredStatus with optional designator functions when list syntax is excluded', () => {
    expect(applyRequiredStatusTest('[[[Int!]]!]!', '?')).to.equal(
      '[[[Int!]]!]'
    );
  });
});
