/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import inspect from '../jsutils/inspect';
import { Source } from '../language/source';
import { createLexer, TokenKind } from '../language/lexer';

const slice = String.prototype.slice;

export function stripIgnoredTokens(source: string | Source): string {
  const sourceObj = typeof source === 'string' ? new Source(source) : source;
  if (!(sourceObj instanceof Source)) {
    throw new TypeError(`Must provide Source. Received: ${inspect(sourceObj)}`);
  }

  const body = sourceObj.body;
  const lexer = createLexer(sourceObj);
  let strippedBody = '';

  let previousToken = lexer.token;
  let currentToken = lexer.advance();

  while (currentToken.kind !== TokenKind.EOF) {
    if (currentToken.kind === TokenKind.COMMENT) {
      continue;
    }

    if (currentToken.value && previousToken.value) {
      strippedBody += ' ';
    }

    strippedBody += slice.call(body, currentToken.start, currentToken.end);

    previousToken = currentToken;
    currentToken = lexer.advance();
  }

  return strippedBody;
}
