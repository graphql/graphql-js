'use strict';

const assert = require('assert');

const ts = require('typescript');

/**
 * Adds extension to all paths imported inside MJS files
 *
 * Transforms:
 *
 *  import { foo } from './bar';
 *  export { foo } from './bar';
 *
 * to:
 *
 *  import { foo } from './bar.mjs';
 *  export { foo } from './bar.mjs';
 *
 */
module.exports = function addExtensionToImportPaths({ extension }) {
  return (context) => {
    const { factory } = context;

    return function visit(node) {
      const source = node.moduleSpecifier?.text;
      if (source?.startsWith('./') || source?.startsWith('../')) {
        if (ts.isImportDeclaration(node)) {
          return factory.updateImportDeclaration(
            node,
            node.decorators,
            node.modifiers,
            node.importClause,
            ts.createStringLiteral(source + extension),
            node.assertClause,
          );
        }
        if (ts.isExportDeclaration(node)) {
          return factory.updateExportDeclaration(
            node,
            node.decorators,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            ts.createStringLiteral(source + extension),
            node.assertClause,
          );
        }
        assert(false, 'Unexpected node with moduleSpecifier: ' + node);
      }
      return ts.visitEachChild(node, visit, context);
    };
  };
};
