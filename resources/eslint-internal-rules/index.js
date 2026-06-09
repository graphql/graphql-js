import { mdxTabsSpacingProcessor } from './mdx-tabs-spacing.js';
import { noDirImportRule } from './no-dir-import.js';
import { onlyAsciiRule } from './only-ascii.js';
import { requireGraphqlPublicApiDocsRule } from './require-graphql-public-api-docs.js';
import { requirePublicApiExportsRule } from './require-public-api-exports.js';
import { requireToStringTagRule } from './require-to-string-tag.js';

const internalRulesPlugin = {
  processors: {
    'mdx-tabs-spacing': mdxTabsSpacingProcessor,
  },
  rules: {
    ...onlyAsciiRule,
    ...noDirImportRule,
    ...requireGraphqlPublicApiDocsRule,
    ...requirePublicApiExportsRule,
    ...requireToStringTagRule,
  },
};

export { internalRulesPlugin };
