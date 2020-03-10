// @flow strict

// @noflow

'use strict';
const path = require('path');

const listOfExports = require(path.join(
  process.cwd(),
  '/resources/babel-plugins/',
  'map.json',
));
module.exports = {
  create(context) {
    function isExportedLocallyOnly(name) {
      if (!listOfExports[context.getFilename()]) {
        return true;
      }
      return !listOfExports[context.getFilename()].find(
        value => value === name || value === '*',
      );
    }

    const source = context.getSourceCode();
    /**
     *
     */
    return {
      'ExportNamedDeclaration > :matches(FunctionDeclaration,ClassDeclaration)'(
        node,
      ) {
        if (isExportedLocallyOnly(node.id.name)) {
          if (!source.getJSDocComment(node)) {
            return context.report({
              node,
              message: 'Please enter JSDoC internal functions using @internal',
            });
          }
          if (!source.getJSDocComment(node).value.includes('@internal')) {
            context.report({
              node,
              message: 'Please annotate internal functions using @internal',
            });
          }
        }
      },
    };
  },
};
