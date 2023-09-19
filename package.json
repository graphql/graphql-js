{
  "name": "graphql",
  "version": "16.8.1",
  "description": "A Query Language and Runtime which can target any service.",
  "license": "MIT",
  "private": true,
  "main": "index",
  "module": "index.mjs",
  "typesVersions": {
    ">=4.1.0": {
      "*": [
        "*"
      ]
    }
  },
  "sideEffects": false,
  "homepage": "https://github.com/graphql/graphql-js",
  "bugs": {
    "url": "https://github.com/graphql/graphql-js/issues"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/graphql/graphql-js.git"
  },
  "keywords": [
    "graphql",
    "graphql-js"
  ],
  "engines": {
    "node": "^12.22.0 || ^14.16.0 || ^16.0.0 || >=17.0.0"
  },
  "scripts": {
    "preversion": ". ./resources/checkgit.sh && npm ci --ignore-scripts",
    "version": "node resources/gen-version.js && npm test && git add src/version.ts",
    "fuzzonly": "mocha --full-trace src/**/__tests__/**/*-fuzz.ts",
    "changelog": "node resources/gen-changelog.js",
    "benchmark": "node benchmark/benchmark.js",
    "test": "npm run lint && npm run check && npm run testonly && npm run prettier:check && npm run check:spelling && npm run check:integrations",
    "lint": "eslint --cache --max-warnings 0 .",
    "check": "tsc --pretty",
    "testonly": "mocha --full-trace src/**/__tests__/**/*-test.ts",
    "testonly:cover": "c8 npm run testonly",
    "prettier": "prettier --write --list-different .",
    "prettier:check": "prettier --check .",
    "check:spelling": "cspell --cache --no-progress '**/*'",
    "check:integrations": "npm run build:npm && npm run build:deno && mocha --full-trace integrationTests/*-test.js",
    "start": "DOCUSAURUS_GENERATED_FILES_DIR_NAME=\"$(pwd)/.docusaurus\" docusaurus start ./website",
    "build:website": "DOCUSAURUS_GENERATED_FILES_DIR_NAME=\"$(pwd)/.docusaurus\" docusaurus build --out-dir=\"$(pwd)/websiteDist\" ./website",
    "build:npm": "node resources/build-npm.js",
    "build:deno": "node resources/build-deno.js",
    "gitpublish:npm": "bash ./resources/gitpublish.sh npm npmDist",
    "gitpublish:deno": "bash ./resources/gitpublish.sh deno denoDist"
  },
  "devDependencies": {
    "@babel/core": "7.17.9",
    "@babel/plugin-syntax-typescript": "7.16.7",
    "@babel/plugin-transform-typescript": "7.16.8",
    "@babel/preset-env": "7.16.11",
    "@babel/register": "7.17.7",
    "@docusaurus/core": "2.0.0-beta.18",
    "@docusaurus/preset-classic": "2.0.0-beta.18",
    "@mdx-js/react": "1.6.22",
    "@svgr/webpack": "6.2.1",
    "@types/chai": "4.3.1",
    "@types/mocha": "9.1.0",
    "@types/node": "17.0.24",
    "@typescript-eslint/eslint-plugin": "5.19.0",
    "@typescript-eslint/parser": "5.19.0",
    "c8": "7.11.0",
    "chai": "4.3.6",
    "clsx": "1.1.1",
    "cspell": "5.19.7",
    "docusaurus-plugin-typedoc-api": "1.10.0",
    "eslint": "8.13.0",
    "eslint-plugin-import": "2.26.0",
    "eslint-plugin-internal-rules": "file:./resources/eslint-internal-rules",
    "eslint-plugin-node": "11.1.0",
    "eslint-plugin-react": "7.29.4",
    "eslint-plugin-react-hooks": "4.4.0",
    "eslint-plugin-simple-import-sort": "7.0.0",
    "eslint-plugin-tsdoc": "0.2.16",
    "file-loader": "6.2.0",
    "mocha": "9.2.2",
    "prettier": "2.6.2",
    "prism-react-renderer": "1.3.1",
    "react": "17.0.2",
    "react-dom": "17.0.2",
    "typedoc": "0.22.15",
    "typescript": "4.6.3",
    "url-loader": "4.1.1"
  },
  "publishConfig": {
    "tag": "latest"
  }
}
