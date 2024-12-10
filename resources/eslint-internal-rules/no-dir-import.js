import fs from 'node:fs';
import path from 'node:path';

const noDirImportRule = {
  'no-dir-import': {
    create: noDirImport,
  },
};

export { noDirImportRule };

function noDirImport(context) {
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
}
