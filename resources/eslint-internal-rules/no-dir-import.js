'use strict';

const fs = require('fs');
const path = require('path');

module.exports = function noDirImportRule(context) {
  return {
    ImportDeclaration: checkImportPath,
    ExportNamedDeclaration: checkImportPath,
  };

  function checkImportPath(node) {
    const { source } = node;

    // bail if the declaration doesn't have a source, e.g. "export { foo };"
    if (!source) {
      return;
    }

    const importPath = source.value;
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const baseDir = path.dirname(context.getFilename());
      const resolvedPath = path.resolve(baseDir, importPath);

      if (
        fs.existsSync(resolvedPath) &&
        fs.statSync(resolvedPath).isDirectory()
      ) {
        context.report({
          node: source,
          message: 'It is not allowed to import from directory',
        });
      }
    }
  }
};
