'use strict';

module.exports = {
  meta: {
    schema: [
      {
        type: 'object',
        properties: {
          allowEmoji: {
            type: 'boolean',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create: onlyASCII,
};

function onlyASCII(context) {
  const regExp =
    context.options[0]?.allowEmoji === true
      ? /[^\p{ASCII}\p{Emoji}]+/gu
      : /\P{ASCII}+/gu;

  return {
    Program() {
      const sourceCode = context.getSourceCode();
      const text = sourceCode.getText();

      for (const match of text.matchAll(regExp)) {
        context.report({
          loc: sourceCode.getLocFromIndex(match.index),
          message: `Non-ASCII character "${match[0]}" found.`,
        });
      }
    },
  };
}
