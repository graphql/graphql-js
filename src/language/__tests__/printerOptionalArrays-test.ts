import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../parser';
import { print } from '../printer';
import { visit } from '../visitor';

describe('Printer: optional AST arrays', () => {
  it('prints absent variable and argument definitions', () => {
    const ast = visit(
      parse('query Q { f } type Query { f: String } directive @d on FIELD'),
      {
        OperationDefinition(node) {
          return { ...node, variableDefinitions: undefined };
        },
        FieldDefinition(node) {
          return { ...node, arguments: undefined };
        },
        DirectiveDefinition(node) {
          return { ...node, arguments: undefined };
        },
      },
    );
    expect(print(ast)).to.equal(
      'query Q {\n  f\n}\n\ntype Query {\n  f: String\n}\n\ndirective @d on FIELD',
    );
  });
});
