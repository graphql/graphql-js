import ts from 'typescript';

export function optimizeArrayDestructuring() {
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const { factory } = context;

    return (sourceFile: ts.SourceFile): ts.SourceFile => {
      const visitor = (node: ts.Node): ts.Node => {
        if (ts.isArrayBindingPattern(node)) {
          const elements = node.elements
            .map((el, i) => {
              if (!el.getText()) {
                return undefined;
              }
              return { key: String(i), name: el.getText() };
            })
            .filter(Boolean) as Array<{ key: string; name: string }>;

          const objectBindingPattern = factory.createObjectBindingPattern(
            elements.map((el) => {
              const key = factory.createIdentifier(el.key);
              const name = factory.createIdentifier(el.name);
              return factory.createBindingElement(undefined, key, name);
            }),
          );
          return objectBindingPattern;
        }

        return ts.visitEachChild(node, visitor, context);
      };
      return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
    };
  };

  return transformer;
}
