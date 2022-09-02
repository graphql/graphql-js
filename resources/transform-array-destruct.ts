import * as ts from 'typescript';

export function transformArrayDestructuring() {
  return (context: ts.TransformationContext) => {
    const { factory } = context;

    return (sourceFile: ts.SourceFile) => {
      const visitor = (node: ts.Node): ts.Node => {
        if (ts.isArrayBindingPattern(node)) {
          const elements = node.elements
            .map((el, i) => {
              if (!el.getText()) {
                return undefined;
              }
              return { key: String(i), name: el.getText() };
            })
            .filter(Boolean);

          const els = elements
            .map((el) => {
              if (!el) {
                return undefined;
              }
              const key = factory.createIdentifier(el.key);
              const name = factory.createIdentifier(el.name);
              return factory.createBindingElement(undefined, key, name);
            })
            .filter(Boolean) as Array<ts.BindingElement>;
          return factory.createObjectBindingPattern(els);
        }

        return ts.visitEachChild(node, visitor, context);
      };
      return ts.visitNode(sourceFile, visitor);
    };
  };
}
