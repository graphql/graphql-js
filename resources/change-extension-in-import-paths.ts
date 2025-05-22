import assert from 'node:assert';
import util from 'node:util';

import ts from 'typescript';

/**
 * Adds extension to all paths imported inside MJS files
 *
 * Transforms:
 *
 * ```
 * import { foo } from './bar.js';
 * export { foo } from './bar.js';
 * ```
 *
 * to:
 *
 * ```
 * import { foo } from './bar.ts';
 * export { foo } from './bar.ts';
 * ```
 *
 */
export function changeExtensionInImportPaths(config: { extension: string }) {
  const { extension } = config;
  return (context: ts.TransformationContext) => {
    const { factory } = context;

    return visitSourceFile;

    function visitSourceFile(sourceFile: ts.SourceFile) {
      return ts.visitNode(sourceFile, visitNode, ts.isSourceFile);
    }

    function visitNode(node: ts.Node): ts.Node {
      const source: string | undefined = (node as any).moduleSpecifier?.text;
      if (source?.startsWith('./') || source?.startsWith('../')) {
        const newSource = source.replace(/\.js$/, extension);

        if (ts.isImportDeclaration(node)) {
          return factory.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            factory.createStringLiteral(newSource),
            node.assertClause,
          );
        }
        if (ts.isExportDeclaration(node)) {
          return factory.updateExportDeclaration(
            node,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            factory.createStringLiteral(newSource),
            node.assertClause,
          );
        }

        assert(
          false,
          'Unexpected node with moduleSpecifier: ' + util.inspect(node),
        );
      }
      return ts.visitEachChild(node, visitNode, context);
    }
  };
}
