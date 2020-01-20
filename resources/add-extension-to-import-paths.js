// @noflow

'use strict';

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
module.exports = function addExtensionToImportPaths(context) {
  const { types } = context;

  return {
    visitor: {
      ImportDeclaration: replaceImportPath,
      ExportNamedDeclaration: replaceImportPath,
    },
  };

  function replaceImportPath(path) {
    // bail if the declaration doesn't have a source, e.g. "export { foo };"
    if (!path.node.source) {
      return;
    }

    const source = path.node.source.value;
    if (source.startsWith('./') || source.startsWith('../')) {
      if (!source.endsWith('.mjs')) {
        const newSourceNode = types.stringLiteral(source + '.mjs');
        path.get('source').replaceWith(newSourceNode);
      }
    }
  }
};
