import * as assert from 'node:assert';
import * as util from 'node:util';

import * as ts from 'typescript';

/**
 * Adds extension to all paths imported inside MJS files
 *
 * Transforms:
 *
 * ```
 * import { foo } from './bar';
 * export { foo } from './bar';
 * ```
 *
 * to:
 *
 * ```
 * import { foo } from './bar.mjs';
 * export { foo } from './bar.mjs';
 * ```
 *
 */
export function addExtensionToImportPaths(config: { extension: string }) {
  const { extension } = config;
  return (context: ts.TransformationContext) => {
    const { factory } = context;

    return visitSourceFile;

    function visitSourceFile(sourceFile: ts.SourceFile) {
      return ts.visitNode(sourceFile, visitNode);
    }

    function visitNode(node: ts.Node): ts.Node {
      const source: string | undefined = (node as any).moduleSpecifier?.text;
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

        assert(
          false,
          'Unexpected node with moduleSpecifier: ' + util.inspect(node),
        );
      }
      return ts.visitEachChild(node, visitNode, context);
    }
  };
}
