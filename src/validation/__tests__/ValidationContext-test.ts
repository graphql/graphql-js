import { expect } from 'chai';
import { describe, it } from 'mocha';

import { identityFunc } from '../../jsutils/identityFunc';

import { parse } from '../../language/parser';

import { GraphQLSchema } from '../../type/schema';

import { TypeInfo } from '../../utilities/TypeInfo';

import {
  ASTValidationContext,
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext';

describe('ValidationContext', () => {
  it('can be Object.toStringified', () => {
    const schema = new GraphQLSchema({});
    const typeInfo = new TypeInfo(schema);
    const ast = parse('{ foo }');
    const onError = identityFunc;

    const astContext = new ASTValidationContext(ast, onError);
    expect(Object.prototype.toString.call(astContext)).to.equal(
      '[object ASTValidationContext]',
    );

    const sdlContext = new SDLValidationContext(ast, schema, onError);
    expect(Object.prototype.toString.call(sdlContext)).to.equal(
      '[object SDLValidationContext]',
    );

    const context = new ValidationContext(schema, ast, typeInfo, onError);
    expect(Object.prototype.toString.call(context)).to.equal(
      '[object ValidationContext]',
    );
  });
});
