module.exports = {
  parserOptions: {
    sourceType: 'script',
  },
  env: {
    es2022: true,
    'shared-node-browser': true,
  },
  reportUnusedDisableDirectives: true,
  plugins: ['n', 'import', 'simple-import-sort'],
  settings: {
    // eslint-plugin-import tries to parse all imported files included huge ones (e.g. 'typescript')
    // that leads to very poor perfomance so to fix that we disable all checks on external files.
    'import/ignore': '/node_modules/',
  },
  rules: {
    //////////////////////////////////////////////////////////////////////////////
    // Internal rules located in 'resources/eslint-internal-rules'.
    //////////////////////////////////////////////////////////////////////////////

    'only-ascii': 'error',
    'no-dir-import': 'error',
    'require-to-string-tag': 'off',

    //////////////////////////////////////////////////////////////////////////////
    // `eslint-plugin-n` rule list based on `v15.7.x`
    //////////////////////////////////////////////////////////////////////////////

    // Possible Errors
    // https://github.com/eslint-community/eslint-plugin-n#possible-errors
    'n/handle-callback-err': ['error', 'error'],
    'n/no-callback-literal': 'error',
    'n/no-exports-assign': 'error',
    'n/no-extraneous-import': 'error',
    'n/no-extraneous-require': 'error',
    'n/no-missing-import': 'error',
    'n/no-missing-require': 'error',
    'n/no-new-require': 'error',
    'n/no-path-concat': 'error',
    'n/no-process-exit': 'off',
    'n/no-unpublished-bin': 'error',
    'n/no-unpublished-import': 'error',
    'n/no-unpublished-require': 'error',
    'n/no-unsupported-features/es-builtins': 'error',
    'n/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }],
    'n/no-unsupported-features/node-builtins': 'error',
    'n/process-exit-as-throw': 'error',
    'n/shebang': 'error',

    // Best Practices
    // https://github.com/eslint-community/eslint-plugin-n#best-practices
    'n/no-deprecated-api': 'error',

    // Stylistic Issues
    // https://github.com/eslint-community/eslint-plugin-n#stylistic-issues
    'n/callback-return': 'error',
    'n/exports-style': 'off', // TODO: consider
    'n/file-extension-in-import': 'error',
    'n/global-require': 'error',
    'n/no-mixed-requires': 'error',
    'n/no-process-env': 'off',
    'n/no-restricted-import': 'off',
    'n/no-restricted-require': 'off',
    'n/no-sync': 'error',
    'n/prefer-global/buffer': 'error',
    'n/prefer-global/console': 'error',
    'n/prefer-global/process': 'error',
    'n/prefer-global/text-decoder': 'error',
    'n/prefer-global/text-encoder': 'error',
    'n/prefer-global/url-search-params': 'error',
    'n/prefer-global/url': 'error',
    'n/prefer-promises/dns': 'off',
    'n/prefer-promises/fs': 'off',

    //////////////////////////////////////////////////////////////////////////////
    // `eslint-plugin-import` rule list based on `v2.27.x`
    //////////////////////////////////////////////////////////////////////////////

    // Static analysis
    // https://github.com/benmosher/eslint-plugin-import#static-analysis
    'import/no-unresolved': 'off', // TODO:  blocked by https://github.com/import-js/eslint-plugin-import/issues/2170
    'import/named': 'error',
    'import/default': 'error',
    'import/namespace': 'error',
    'import/no-restricted-paths': [
      'error',
      {
        basePath: './',
        zones: [{ target: './src', from: 'src/__testUtils__' }],
      },
    ],
    'import/no-absolute-path': 'error',
    'import/no-dynamic-require': 'error',
    'import/no-internal-modules': 'off',
    'import/no-webpack-loader-syntax': 'error',
    'import/no-self-import': 'error',
    'import/no-cycle': 'error',
    'import/no-useless-path-segments': 'error',
    'import/no-relative-parent-imports': 'off',
    'import/no-relative-packages': 'off',

    // Helpful warnings
    // https://github.com/benmosher/eslint-plugin-import#helpful-warnings
    'import/export': 'error',
    'import/no-named-as-default': 'error',
    'import/no-named-as-default-member': 'error',
    'import/no-deprecated': 'error',
    'import/no-extraneous-dependencies': ['error', { devDependencies: false }],
    'import/no-mutable-exports': 'error',
    'import/no-unused-modules': 'error',
    'import/no-empty-named-blocks': 'error',

    // Module systems
    // https://github.com/benmosher/eslint-plugin-import#module-systems
    'import/unambiguous': 'error',
    'import/no-commonjs': 'error',
    'import/no-amd': 'error',
    'import/no-nodejs-modules': 'error',
    'import/no-import-module-exports': 'off',

    // Style guide
    // https://github.com/benmosher/eslint-plugin-import#style-guide
    'import/consistent-type-specifier-style': 'error',
    'import/first': 'error',
    'import/exports-last': 'off',
    'import/no-duplicates': 'error',
    'import/no-namespace': 'error',
    'import/extensions': ['error', 'ignorePackages'],
    'import/order': [
      'error',
      { 'newlines-between': 'always-and-inside-groups' },
    ],
    'import/newline-after-import': 'error',
    'import/prefer-default-export': 'off',
    'import/max-dependencies': 'off',
    'import/no-unassigned-import': 'error',
    'import/no-named-default': 'error',
    'import/no-default-export': 'error',
    'import/no-named-export': 'off',
    'import/no-anonymous-default-export': 'error',
    'import/group-exports': 'off',
    'import/dynamic-import-chunkname': 'off',

    //////////////////////////////////////////////////////////////////////////////
    // `eslint-plugin-simple-import-sort` rule list based on `v10.0.x`
    // https://github.com/lydell/eslint-plugin-simple-import-sort
    //////////////////////////////////////////////////////////////////////////////

    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          // Node.js builtin modules
          ['^node:\\w'],

          // Packages.
          // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
          ['^@?\\w'],

          // General utilities
          ['^(\\./|(\\.\\./)+)__testUtils__/'],
          ['^(\\./|(\\.\\./)+)jsutils/'],

          // Top-level directories
          ['^(\\./|(\\.\\./)+)error/'],
          ['^(\\./|(\\.\\./)+)language/'],
          ['^(\\./|(\\.\\./)+)type/'],
          ['^(\\./|(\\.\\./)+)validation/'],
          ['^(\\./|(\\.\\./)+)execution/'],
          ['^(\\./|(\\.\\./)+)utilities/'],

          // Relative imports.
          // Anything that starts with a dot.
          ['^(\\.\\./){4,}'],
          ['^(\\.\\./){3}'],
          ['^(\\.\\./){2}'],
          ['^(\\.\\./){1}'],
          ['^\\./'],
        ],
      },
    ],
    'simple-import-sort/exports': 'off', // TODO: error

    //////////////////////////////////////////////////////////////////////////////
    // ESLint builtin rules list based on `v8.34.x`
    //////////////////////////////////////////////////////////////////////////////

    // Possible Errors
    // https://eslint.org/docs/latest/rules/#possible-problems
    'array-callback-return': 'error',
    'constructor-super': 'error',
    'for-direction': 'error',
    'getter-return': 'error',
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'error',
    'no-class-assign': 'error',
    'no-compare-neg-zero': 'error',
    'no-cond-assign': 'error',
    'no-const-assign': 'error',
    'no-constant-binary-expression': 'error',
    'no-constant-condition': 'error',
    'no-constructor-return': 'error',
    'no-control-regex': 'error',
    'no-debugger': 'warn',
    'no-dupe-args': 'error',
    'no-dupe-class-members': 'error',
    'no-dupe-else-if': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-duplicate-imports': 'off', // Superseded by `import/no-duplicates`
    'no-empty-character-class': 'error',
    'no-empty-pattern': 'error',
    'no-ex-assign': 'error',
    'no-fallthrough': 'error',
    'no-func-assign': 'error',
    'no-import-assign': 'error',
    'no-inner-declarations': ['error', 'both'],
    'no-invalid-regexp': 'error',
    'no-irregular-whitespace': 'error',
    'no-loss-of-precision': 'error',
    'no-misleading-character-class': 'error',
    'no-new-native-nonconstructor': 'error',
    'no-new-symbol': 'error',
    'no-obj-calls': 'error',
    'no-promise-executor-return': 'off', // TODO: error
    'no-prototype-builtins': 'error',
    'no-self-assign': 'error',
    'no-self-compare': 'off', // TODO: error
    'no-setter-return': 'error',
    'no-sparse-arrays': 'error',
    'no-template-curly-in-string': 'error',
    'no-this-before-super': 'error',
    'no-undef': 'error',
    'no-unexpected-multiline': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unreachable': 'error',
    'no-unreachable-loop': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    'no-unsafe-optional-chaining': [
      'error',
      { disallowArithmeticOperators: true },
    ],
    'no-unused-private-class-members': 'error',
    'no-unused-vars': [
      'error',
      { vars: 'all', args: 'all', argsIgnorePattern: '^_' },
    ],
    'no-use-before-define': 'off',
    'no-useless-backreference': 'error',
    'require-atomic-updates': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',

    // Suggestions
    // https://eslint.org/docs/latest/rules/#suggestions
    'accessor-pairs': 'error',
    'arrow-body-style': 'error',
    'block-scoped-var': 'error',
    camelcase: 'error',
    'capitalized-comments': 'off', // TODO: consider
    'class-methods-use-this': 'off',
    complexity: 'off',
    'consistent-return': 'off',
    'consistent-this': 'error',
    curly: 'error',
    'default-case': 'off',
    'default-case-last': 'error',
    'default-param-last': 'error',
    'dot-notation': 'error',
    eqeqeq: ['error', 'smart'],
    'func-name-matching': 'off',
    'func-names': ['error', 'as-needed'], // improve debug experience
    'func-style': 'off',
    'grouped-accessor-pairs': 'error',
    'guard-for-in': 'error',
    'id-denylist': 'off',
    'id-length': 'off',
    'id-match': ['error', '^(?:_?[a-zA-Z0-9]*)|[_A-Z0-9]+$'],
    'init-declarations': 'off',
    'logical-assignment-operators': 'error',
    'max-classes-per-file': 'off',
    'max-depth': 'off',
    'max-lines': 'off',
    'max-lines-per-function': 'off',
    'max-nested-callbacks': 'off',
    'max-params': ['error', 5], // TODO: drop to default number, which is 3
    'max-statements': 'off',
    'multiline-comment-style': 'off',
    'new-cap': 'error',
    'no-alert': 'error',
    'no-array-constructor': 'error',
    'no-bitwise': 'off',
    'no-caller': 'error',
    'no-case-declarations': 'error',
    'no-confusing-arrow': 'off',
    'no-console': 'warn',
    'no-continue': 'off',
    'no-delete-var': 'error',
    'no-div-regex': 'error',
    'no-else-return': 'error',
    'no-empty': 'error',
    'no-empty-function': 'error',
    'no-empty-static-block': 'error',
    'no-eq-null': 'off',
    'no-eval': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-extra-boolean-cast': 'error',
    'no-extra-label': 'error',
    'no-extra-semi': 'off',
    'no-floating-decimal': 'off',
    'no-global-assign': 'error',
    'no-implicit-coercion': 'error',
    'no-implicit-globals': 'off',
    'no-implied-eval': 'error',
    'no-inline-comments': 'off',
    'no-invalid-this': 'error',
    'no-iterator': 'error',
    'no-label-var': 'error',
    'no-labels': 'error',
    'no-lone-blocks': 'error',
    'no-lonely-if': 'error',
    'no-loop-func': 'error',
    'no-magic-numbers': 'off',
    'no-mixed-operators': 'off',
    'no-multi-assign': 'off',
    'no-multi-str': 'error',
    'no-negated-condition': 'off',
    'no-nested-ternary': 'off',
    'no-new': 'error',
    'no-new-func': 'error',
    'no-new-object': 'error',
    'no-new-wrappers': 'error',
    'no-nonoctal-decimal-escape': 'error',
    'no-octal': 'error',
    'no-octal-escape': 'error',
    'no-param-reassign': 'error',
    'no-plusplus': 'off',
    'no-proto': 'error',
    'no-redeclare': 'error',
    'no-regex-spaces': 'error',
    'no-restricted-exports': [
      'error',
      { restrictDefaultExports: { direct: true } },
    ],
    'no-restricted-globals': 'off',
    'no-restricted-imports': 'off',
    'no-restricted-properties': 'off',
    'no-restricted-syntax': 'off',
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'no-script-url': 'error',
    'no-sequences': 'error',
    'no-shadow': 'error',
    'no-shadow-restricted-names': 'error',
    'no-ternary': 'off',
    'no-throw-literal': 'error',
    'no-undef-init': 'error',
    'no-undefined': 'off',
    'no-underscore-dangle': 'off', // TODO: error
    'no-unneeded-ternary': 'error',
    'no-unused-expressions': 'error',
    'no-unused-labels': 'error',
    'no-useless-call': 'error',
    'no-useless-catch': 'error',
    'no-useless-computed-key': 'error',
    'no-useless-concat': 'error',
    'no-useless-constructor': 'error',
    'no-useless-escape': 'error',
    'no-useless-rename': 'error',
    'no-useless-return': 'error',
    'no-var': 'error',
    'no-void': 'error',
    'no-warning-comments': 'off',
    'no-with': 'error',
    'object-shorthand': 'error',
    'one-var': ['error', 'never'],
    'one-var-declaration-per-line': 'off',
    'operator-assignment': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-const': 'error',
    'prefer-destructuring': 'off',
    'prefer-exponentiation-operator': 'error',
    'prefer-named-capture-group': 'off', // TODO: needs a better support in TS, see https://github.com/microsoft/TypeScript/issues/32098
    'prefer-numeric-literals': 'error',
    'prefer-object-has-own': 'error',
    'prefer-object-spread': 'error',
    'prefer-promise-reject-errors': 'error',
    'prefer-regex-literals': 'error',
    'prefer-rest-params': 'off', // TODO: error
    'prefer-spread': 'error',
    'prefer-template': 'off',
    'quote-props': ['error', 'as-needed'],
    radix: 'error',
    'require-await': 'error',
    'require-unicode-regexp': 'off',
    'require-yield': 'error',
    'sort-imports': 'off',
    'sort-keys': 'off',
    'sort-vars': 'off',
    'spaced-comment': 'error',
    strict: 'error',
    'symbol-description': 'off',
    'vars-on-top': 'error',
    yoda: ['error', 'never', { exceptRange: true }],

    // Layout & Formatting
    // https://eslint.org/docs/latest/rules/#layout--formatting
    'line-comment-position': 'off',
    'lines-around-comment': 'off',
    'lines-between-class-members': [
      'error',
      'always',
      { exceptAfterSingleLine: true },
    ],
    'max-statements-per-line': 'off',
    'no-tabs': 'error',
    'padding-line-between-statements': 'off',
    quotes: ['error', 'single', { avoidEscape: true }],

    // Bellow rules are disabled because coflicts with Prettier, see:
    // https://github.com/prettier/eslint-config-prettier/blob/master/index.js
    'array-bracket-newline': 'off',
    'array-bracket-spacing': 'off',
    'array-element-newline': 'off',
    'arrow-parens': 'off',
    'arrow-spacing': 'off',
    'block-spacing': 'off',
    'brace-style': 'off',
    'comma-dangle': 'off',
    'comma-spacing': 'off',
    'comma-style': 'off',
    'computed-property-spacing': 'off',
    'dot-location': 'off',
    'eol-last': 'off',
    'func-call-spacing': 'off',
    'function-call-argument-newline': 'off',
    'function-paren-newline': 'off',
    'generator-star-spacing': 'off',
    'implicit-arrow-linebreak': 'off',
    indent: 'off',
    'jsx-quotes': 'off',
    'key-spacing': 'off',
    'keyword-spacing': 'off',
    'linebreak-style': 'off',
    'max-len': 'off',
    'multiline-ternary': 'off',
    'newline-per-chained-call': 'off',
    'new-parens': 'off',
    'no-extra-parens': 'off',
    'no-mixed-spaces-and-tabs': 'off',
    'no-multi-spaces': 'off',
    'no-multiple-empty-lines': 'off',
    'no-trailing-spaces': 'off',
    'no-whitespace-before-property': 'off',
    'nonblock-statement-body-position': 'off',
    'object-curly-newline': 'off',
    'object-curly-spacing': 'off',
    'object-property-newline': 'off',
    'operator-linebreak': 'off',
    'padded-blocks': 'off',
    'rest-spread-spacing': 'off',
    semi: 'off',
    'semi-spacing': 'off',
    'semi-style': 'off',
    'space-before-blocks': 'off',
    'space-before-function-paren': 'off',
    'space-in-parens': 'off',
    'space-infix-ops': 'off',
    'space-unary-ops': 'off',
    'switch-colon-spacing': 'off',
    'template-curly-spacing': 'off',
    'template-tag-spacing': 'off',
    'unicode-bom': 'off',
    'wrap-iife': 'off',
    'wrap-regex': 'off',
    'yield-star-spacing': 'off',
  },
  overrides: [
    {
      files: 'integrationTests/node-esm/**/*.js',
      parserOptions: {
        sourceType: 'module',
      },
    },
    {
      files: '**/*.ts',
      parser: '@typescript-eslint/parser',
      parserOptions: {
        sourceType: 'module',
        project: ['tsconfig.json'],
      },
      plugins: ['@typescript-eslint', 'eslint-plugin-tsdoc'],
      extends: ['plugin:import/typescript'],
      rules: {
        //////////////////////////////////////////////////////////////////////////
        // `eslint-plugin-tsdoc` rule list based on `v0.2.x`
        // https://github.com/microsoft/tsdoc/tree/master/eslint-plugin
        //////////////////////////////////////////////////////////////////////////

        'tsdoc/syntax': 'error',

        //////////////////////////////////////////////////////////////////////////
        // `@typescript-eslint/eslint-plugin` rule list based on `v5.53.x`
        //////////////////////////////////////////////////////////////////////////

        // Supported Rules
        // https://typescript-eslint.io/rules/#extension-rules
        '@typescript-eslint/adjacent-overload-signatures': 'error',
        '@typescript-eslint/array-type': ['error', { default: 'generic' }],
        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/ban-ts-comment': [
          'error',
          { 'ts-expect-error': false },
        ],
        '@typescript-eslint/ban-tslint-comment': 'error',
        '@typescript-eslint/ban-types': 'off', // TODO: temporarily disabled
        '@typescript-eslint/class-literal-property-style': 'off', // TODO: enable after TS conversion
        '@typescript-eslint/consistent-generic-constructors': 'error',
        '@typescript-eslint/consistent-indexed-object-style': [
          'error',
          'index-signature',
        ],
        '@typescript-eslint/consistent-type-assertions': 'off', // TODO: temporarily disable
        '@typescript-eslint/consistent-type-definitions': 'error',
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/explicit-function-return-type': 'off', // TODO: consider
        '@typescript-eslint/explicit-member-accessibility': 'off', // TODO: consider
        '@typescript-eslint/explicit-module-boundary-types': 'off', // TODO: consider
        '@typescript-eslint/member-ordering': 'error',
        '@typescript-eslint/method-signature-style': 'error',
        '@typescript-eslint/naming-convention': 'off', // TODO: consider
        '@typescript-eslint/no-base-to-string': 'error',
        '@typescript-eslint/no-confusing-non-null-assertion': 'error',
        '@typescript-eslint/no-confusing-void-expression': 'off', // TODO: enable with ignoreArrowShorthand
        '@typescript-eslint/no-duplicate-enum-values': 'error',
        '@typescript-eslint/no-dynamic-delete': 'off',
        '@typescript-eslint/no-empty-interface': 'error',
        '@typescript-eslint/no-explicit-any': 'off', // TODO: error
        '@typescript-eslint/no-extra-non-null-assertion': 'error',
        '@typescript-eslint/no-extraneous-class': 'off', // TODO: consider
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-for-in-array': 'error',
        '@typescript-eslint/no-implicit-any-catch': 'off', // TODO: Enable after TS conversion
        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/no-implied-eval': 'error',
        '@typescript-eslint/no-inferrable-types': [
          'error',
          { ignoreParameters: true, ignoreProperties: true },
        ],
        '@typescript-eslint/no-misused-new': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/no-mixed-enums': 'error',
        '@typescript-eslint/no-namespace': 'error',
        '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
        '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/no-redundant-type-constituents': 'error',
        '@typescript-eslint/no-invalid-void-type': 'error',
        '@typescript-eslint/no-require-imports': 'error',
        '@typescript-eslint/no-this-alias': 'error',
        '@typescript-eslint/no-type-alias': 'off', // TODO: consider
        '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
        '@typescript-eslint/no-unnecessary-condition': 'off', // TODO: temporary disable
        '@typescript-eslint/no-unnecessary-qualifier': 'error',
        '@typescript-eslint/no-unnecessary-type-arguments': 'error',
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/no-unnecessary-type-constraint': 'error',
        '@typescript-eslint/no-unsafe-argument': 'off', // TODO: consider
        '@typescript-eslint/no-unsafe-assignment': 'off', // TODO: consider
        '@typescript-eslint/no-unsafe-call': 'off', // TODO: consider
        '@typescript-eslint/no-unsafe-declaration-merging': 'error',
        '@typescript-eslint/no-unsafe-member-access': 'off', // TODO: consider
        '@typescript-eslint/no-unsafe-return': 'off', // TODO: consider
        '@typescript-eslint/no-useless-empty-export': 'error',
        '@typescript-eslint/no-var-requires': 'error',
        '@typescript-eslint/non-nullable-type-assertion-style': 'off', //TODO: temporarily disabled
        '@typescript-eslint/parameter-properties': 'error',
        '@typescript-eslint/prefer-as-const': 'error',
        '@typescript-eslint/prefer-enum-initializers': 'error',
        '@typescript-eslint/prefer-for-of': 'error',
        '@typescript-eslint/prefer-function-type': 'error',
        '@typescript-eslint/prefer-includes': 'error',
        '@typescript-eslint/prefer-literal-enum-member': 'error',
        '@typescript-eslint/prefer-namespace-keyword': 'error',
        '@typescript-eslint/prefer-nullish-coalescing': 'error',
        '@typescript-eslint/prefer-optional-chain': 'error',
        '@typescript-eslint/prefer-readonly': 'off',
        '@typescript-eslint/prefer-readonly-parameter-types': 'off', // TODO: consider
        '@typescript-eslint/prefer-reduce-type-parameter': 'error',
        '@typescript-eslint/prefer-regexp-exec': 'off',
        '@typescript-eslint/prefer-return-this-type': 'error',
        '@typescript-eslint/prefer-string-starts-ends-with': 'error',
        '@typescript-eslint/prefer-ts-expect-error': 'error',
        '@typescript-eslint/promise-function-async': 'off',
        '@typescript-eslint/require-array-sort-compare': 'error',
        '@typescript-eslint/restrict-plus-operands': 'off', // TODO: temporarily disabled
        '@typescript-eslint/restrict-template-expressions': 'off', // TODO: temporarily disabled
        '@typescript-eslint/sort-type-union-intersection-members': 'off', // TODO: consider
        '@typescript-eslint/strict-boolean-expressions': [
          'error',
          { allowNullableBoolean: true }, // TODO: consider removing
        ],
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        '@typescript-eslint/triple-slash-reference': 'error',
        '@typescript-eslint/typedef': 'off',
        '@typescript-eslint/unbound-method': 'off', // TODO: consider
        '@typescript-eslint/unified-signatures': 'error',

        // Extension Rules
        // https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin#extension-rules

        // Disable conflicting ESLint rules and enable TS-compatible ones
        'default-param-last': 'off',
        'dot-notation': 'off',
        'lines-between-class-members': 'off',
        'no-array-constructor': 'off',
        'no-dupe-class-members': 'off',
        'no-empty-function': 'off',
        'no-invalid-this': 'off',
        'no-loop-func': 'off',
        'no-loss-of-precision': 'off',
        'no-redeclare': 'off',
        'no-throw-literal': 'off',
        'no-shadow': 'off',
        'no-unused-expressions': 'off',
        'no-unused-vars': 'off',
        'no-useless-constructor': 'off',
        'require-await': 'off',
        'no-return-await': 'off',
        '@typescript-eslint/default-param-last': 'error',
        '@typescript-eslint/dot-notation': 'error',
        '@typescript-eslint/lines-between-class-members': [
          'error',
          'always',
          { exceptAfterSingleLine: true },
        ],
        '@typescript-eslint/no-array-constructor': 'error',
        '@typescript-eslint/no-dupe-class-members': 'error',
        '@typescript-eslint/no-empty-function': 'error',
        '@typescript-eslint/no-invalid-this': 'error',
        '@typescript-eslint/no-loop-func': 'error',
        '@typescript-eslint/no-loss-of-precision': 'error',
        '@typescript-eslint/no-redeclare': 'error',
        '@typescript-eslint/no-throw-literal': 'error', // TODO: [error, { allowThrowingAny: false, allowThrowingUnknown: false }]
        '@typescript-eslint/no-shadow': 'error',
        '@typescript-eslint/no-unused-expressions': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            vars: 'all',
            args: 'all',
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_T',
          },
        ],
        '@typescript-eslint/no-useless-constructor': 'error',
        '@typescript-eslint/require-await': 'error',
        '@typescript-eslint/return-await': 'error',

        // Disable for JS and TS
        '@typescript-eslint/init-declarations': 'off',
        '@typescript-eslint/no-magic-numbers': 'off',
        '@typescript-eslint/no-restricted-imports': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
        '@typescript-eslint/no-duplicate-imports': 'off', // Superseded by `import/no-duplicates`

        // Below rules are disabled because they conflict with Prettier, see:
        // https://github.com/prettier/eslint-config-prettier/blob/main/index.js
        '@typescript-eslint/block-spacing': 'off',
        '@typescript-eslint/object-curly-spacing': 'off',
        '@typescript-eslint/quotes': 'off',
        '@typescript-eslint/brace-style': 'off',
        '@typescript-eslint/comma-dangle': 'off',
        '@typescript-eslint/comma-spacing': 'off',
        '@typescript-eslint/func-call-spacing': 'off',
        '@typescript-eslint/indent': 'off',
        '@typescript-eslint/key-spacing': 'off',
        '@typescript-eslint/keyword-spacing': 'off',
        '@typescript-eslint/member-delimiter-style': 'off',
        '@typescript-eslint/no-extra-parens': 'off',
        '@typescript-eslint/no-extra-semi': 'off',
        '@typescript-eslint/semi': 'off',
        '@typescript-eslint/space-before-blocks': 'off',
        '@typescript-eslint/space-before-function-paren': 'off',
        '@typescript-eslint/space-infix-ops': 'off',
        '@typescript-eslint/type-annotation-spacing': 'off',
      },
    },
    {
      files: 'src/**',
      rules: {
        'require-to-string-tag': 'error',
      },
    },
    {
      files: 'src/**/__*__/**',
      rules: {
        'require-to-string-tag': 'off',
        'n/no-unpublished-import': [
          'error',
          { allowModules: ['chai', 'mocha'] },
        ],
        'import/no-deprecated': 'off',
        'import/no-restricted-paths': 'off',
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
      },
    },
    {
      files: 'integrationTests/*',
      env: {
        node: true,
      },
      rules: {
        'n/no-sync': 'off',
        'n/no-unpublished-import': ['error', { allowModules: ['mocha'] }],
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
        'import/no-namespace': 'off',
        'import/no-nodejs-modules': 'off',
      },
    },
    {
      files: 'integrationTests/*/**',
      parserOptions: {
        sourceType: 'module',
      },
      env: {
        node: true,
      },
      rules: {
        'n/no-sync': 'off',
        'import/no-nodejs-modules': 'off',
        'no-console': 'off',
        'n/no-missing-import': ['error', { allowModules: ['graphql'] }],
      },
    },
    {
      files: 'benchmark/**',
      parserOptions: {
        sourceType: 'module',
      },
      env: {
        node: true,
      },
      rules: {
        'n/no-sync': 'off',
        'n/no-missing-import': ['error', { allowModules: ['graphql'] }],
        'n/no-extraneous-import': ['error', { allowModules: ['graphql'] }],
        'import/no-unresolved': 'off',
        'import/no-namespace': 'off',
        'import/no-nodejs-modules': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: 'resources/**',
      env: {
        node: true,
      },
      rules: {
        'only-ascii': ['error', { allowEmoji: true }],
        'n/no-unpublished-import': 'off',
        'n/no-sync': 'off',
        'import/no-namespace': 'off',
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
        'import/no-nodejs-modules': 'off',
        'no-console': 'off',
      },
    },
    {
      files: 'resources/eslint-internal-rules/**',
      env: {
        node: true,
      },
      rules: {
        'import/no-commonjs': 'off',
      },
    },
    {
      files: '**/*.jsx',
      parserOptions: {
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      rules: {
        'n/no-unpublished-import': 'off',
        'import/no-default-export': 'off',
      },
    },
    {
      files: 'website/**',
      env: {
        node: true,
      },
      plugins: ['react'],
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        'no-restricted-exports': 'off',
        'n/no-unpublished-require': 'off',
        'import/no-default-export': 'off',
        'import/no-commonjs': 'off',
        'import/no-nodejs-modules': 'off',
        'import/no-extraneous-dependencies': 'off',
        // Ignore docusarus related webpack aliases
        'n/no-missing-import': 'off',
        'import/no-unresolved': [
          'error',
          { ignore: ['^@theme', '^@docusaurus', '^@generated'] },
        ],
      },
    },
  ],
};
