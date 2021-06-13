'use strict';

module.exports = function requireToStringTag(context) {
  const sourceCode = context.getSourceCode();

  return {
    'ExportNamedDeclaration > ClassDeclaration': (classNode) => {
      const properties = classNode.body.body;
      if (properties.some(isToStringTagProperty)) {
        return;
      }

      const jsDoc = context.getJSDocComment(classNode)?.value;
      // FIXME: use proper TSDoc parser instead of includes once we fix TSDoc comments
      if (jsDoc?.includes('@internal') === true) {
        return;
      }

      context.report({
        node: classNode,
        message:
          'All classes in public API required to have [Symbol.toStringTag] method',
      });
    },
  };

  function isToStringTagProperty(propertyNode) {
    if (
      propertyNode.type !== 'MethodDefinition' ||
      propertyNode.kind !== 'get'
    ) {
      return false;
    }
    const keyText = sourceCode.getText(propertyNode.key);
    return keyText === 'Symbol.toStringTag';
  }
};
