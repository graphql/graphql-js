import ts from 'typescript';

export function stripPrivateDeclarations(): ts.TransformerFactory<
  ts.SourceFile | ts.Bundle
> {
  return (
    context: ts.TransformationContext,
  ): ts.Transformer<ts.SourceFile | ts.Bundle> => {
    const transformSourceFile = (sourceFile: ts.SourceFile): ts.SourceFile => {
      const visitNode = (
        node: ts.Node,
      ): ts.VisitResult<ts.Node | undefined> => {
        if (isStripCandidate(node) && hasPrivateTag(node, sourceFile)) {
          return undefined;
        }

        return ts.visitEachChild(node, visitNode, context);
      };

      return ts.visitEachChild(sourceFile, visitNode, context);
    };

    return (rootNode: ts.SourceFile | ts.Bundle): ts.SourceFile | ts.Bundle =>
      ts.isBundle(rootNode)
        ? context.factory.updateBundle(
            rootNode,
            rootNode.sourceFiles.map(transformSourceFile),
          )
        : transformSourceFile(rootNode);
  };
}

function isStripCandidate(node: ts.Node): boolean {
  return (
    ts.isClassDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isVariableStatement(node)
  );
}

function hasPrivateTag(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  if (
    ts.getJSDocTags(node).some((tag) => tag.tagName.text === 'private') ||
    hasSyntheticPrivateTag(node) ||
    hasSourcePrivateTag(node, sourceFile)
  ) {
    return true;
  }

  return (
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some((declaration) =>
      hasPrivateTag(declaration, sourceFile),
    )
  );
}

function hasSyntheticPrivateTag(node: ts.Node): boolean {
  return (
    ts
      .getSyntheticLeadingComments(node)
      ?.some((comment) => comment.text.includes('@private')) === true
  );
}

function hasSourcePrivateTag(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): boolean {
  return (
    ts
      .getLeadingCommentRanges(sourceFile.text, node.pos)
      ?.some((comment) =>
        sourceFile.text.slice(comment.pos, comment.end).includes('@private'),
      ) === true
  );
}
