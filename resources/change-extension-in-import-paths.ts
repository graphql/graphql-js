import assert from 'node:assert';
import util from 'node:util';

import ts from 'typescript';

/**
 * Transforms:
 *
 * ```
 * import { foo } from './bar.ts';
 * export { foo } from './bar.ts';
 * ```
 *
 * to:
 *
 * ```
 * import { foo } from './bar.js';
 * export { foo } from './bar.js';
 * ```
 *
 */
export function changeExtensionInImportPaths(config: {
  extension: string;
}): ts.TransformerFactory<ts.SourceFile> {
  const { extension } = config;
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const { factory } = context;

    return visitSourceFile;

    function visitSourceFile(sourceFile: ts.SourceFile): ts.SourceFile {
      return ts.visitEachChild(sourceFile, visitNode, context);
    }

    function visitNode(node: ts.Node): ts.Node {
      const source: string | undefined = (node as any).moduleSpecifier?.text;
      if (source?.startsWith('./') || source?.startsWith('../')) {
        const newSource = source.replace(/\.ts$/, extension);

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

export function changeExtensionInImportPathsInBundle(config: {
  extension: string;
}): ts.TransformerFactory<ts.SourceFile | ts.Bundle> {
  return (
    context: ts.TransformationContext,
  ): ts.Transformer<ts.SourceFile | ts.Bundle> => {
    const transformSourceFile = changeExtensionInImportPaths(config)(context);

    return (rootNode: ts.SourceFile | ts.Bundle): ts.SourceFile | ts.Bundle =>
      ts.isBundle(rootNode)
        ? context.factory.updateBundle(
            rootNode,
            rootNode.sourceFiles.map(transformSourceFile),
          )
        : transformSourceFile(rootNode);
  };
}
