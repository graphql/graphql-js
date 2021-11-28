'use strict';

module.exports = function requireCoverageIgnoreReason(context) {
  const istanbulRegExp = /^\s*istanbul\s+ignore\s+(if|else|next|file)\s+/;
  return {
    Program() {
      const sourceCode = context.getSourceCode();

      for (const node of sourceCode.getAllComments()) {
        const comment = node.value;

        if (comment.match(istanbulRegExp)) {
          const reason = comment.replace(istanbulRegExp, '');
          if (!reason.match(/\(.+\)$/)) {
            context.report({
              message: 'Add a reason why code coverage should be ignored',
              node,
            });
          }
        }
      }
    },
  };
};
