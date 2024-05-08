import ts from 'typescript';

export const optimizeArrayDestructuring: ts.TransformerFactory<ts.SourceFile> = (context) => {
  const { factory } = context;

  return (sourceFile) => {
    const visitor = (node: ts.Node): ts.Node => {
      if(ts.isArrayBindingPattern(node)) {
        const elements = node.elements.map((el, i) => {
          if (!el.getText()) return undefined
          return { key: '' + i, name: el.getText() }
        }).filter(Boolean) as Array<{ key: string, name: string }>

        const newElements = elements.map(el => {
          const key = factory.createIdentifier(el.key)
          const name = factory.createIdentifier(el.name)
          return factory.createBindingElement(undefined, key, name)
        })

        const objectBindingPattern = factory.createObjectBindingPattern(newElements)
        return objectBindingPattern
      }

      return ts.visitEachChild(node, visitor, context);
    };
    return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
  };
};

