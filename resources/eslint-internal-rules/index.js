import { noDirImportRule } from './no-dir-import.js';
import { onlyAsciiRule } from './only-ascii.js';
import { requireToStringTagRule } from './require-to-string-tag.js';

const internalRulesPlugin = {
  rules: {
    ...onlyAsciiRule,
    ...noDirImportRule,
    ...requireToStringTagRule,
  },
};

export { internalRulesPlugin };
