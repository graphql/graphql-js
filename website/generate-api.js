/* eslint-disable no-console, n/no-unsupported-features/node-builtins */

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const websiteDir = __dirname;
const repoRequire = createRequire(join(repoRoot, 'package.json'));
const websiteRequire = createRequire(join(websiteDir, 'package.json'));
const typedocTemplatePath = join(__dirname, 'typedoc-api.json');
const tmpDir = mkdtempSync(join(tmpdir(), 'graphql-js-api-'));
const prettier = repoRequire('prettier');
const ts = websiteRequire('typescript');
const prettierConfig = prettier.resolveConfig.sync(repoRoot) ?? {};
const signaturePrettierOptions = {
  ...prettierConfig,
  parser: 'typescript',
};

let generation = {
  docsVersionLabel: 'api-docs',
};
const worktreeDirs = [];

const groupOrder = [
  'Classes',
  'Functions',
  'Constants',
  'Enumerations',
  'Types',
];

// TypeDoc serializes reflection kinds as numeric enum values in JSON.
const ReflectionKind = {
  Namespace: 4,
  Enum: 8,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  IndexSignature: 8192,
  Parameter: 32768,
  TypeAlias: 2097152,
  Reference: 4194304,
};

const keywordLikeIdentifiers = new Set(['false', 'null', 'true', 'undefined']);
const literalTokenKinds = new Set([
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
]);
const typeNodeKeywordNames = new Map([
  [ts.SyntaxKind.AnyKeyword, 'any'],
  [ts.SyntaxKind.BigIntKeyword, 'bigint'],
  [ts.SyntaxKind.BooleanKeyword, 'boolean'],
  [ts.SyntaxKind.NeverKeyword, 'never'],
  [ts.SyntaxKind.NullKeyword, 'null'],
  [ts.SyntaxKind.NumberKeyword, 'number'],
  [ts.SyntaxKind.ObjectKeyword, 'object'],
  [ts.SyntaxKind.StringKeyword, 'string'],
  [ts.SyntaxKind.SymbolKeyword, 'symbol'],
  [ts.SyntaxKind.UndefinedKeyword, 'undefined'],
  [ts.SyntaxKind.UnknownKeyword, 'unknown'],
  [ts.SyntaxKind.VoidKeyword, 'void'],
]);

const apiCodeComponents = ['ApiSignature', 'ApiType'];
const deprecatedTagMarkup =
  '<span aria-label="Deprecated" className="api-tag" title="Deprecated"></span>';

const renderContext = emptyRenderContext();
let sourceContext = emptySourceContext();
const visibleChildrenCache = new WeakMap();

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  const failure = spawnFailureMessage(command, args, cwd, result);
  if (failure != null) {
    throw new Error(failure);
  }
}

function spawnFailureMessage(command, args, cwd, result) {
  const commandText = [command, ...args].join(' ');
  if (result.error != null) {
    return `${commandText} failed to start in ${cwd}: ${result.error.message}`;
  }
  if (result.status !== 0) {
    const reason =
      result.signal == null
        ? `exit code ${result.status}`
        : `signal ${result.signal}`;
    return `${commandText} failed in ${cwd} with ${reason}`;
  }
  return null;
}

function checkoutSourceRef(ref, index) {
  const dir = join(tmpDir, `source-${index}`);
  run('git', ['worktree', 'add', '--detach', dir, ref], repoRoot);
  worktreeDirs.push(dir);
  return dir;
}

function removeSourceWorktrees() {
  for (let i = worktreeDirs.length - 1; i >= 0; i--) {
    const dir = worktreeDirs[i];
    const result = spawnSync('git', ['worktree', 'remove', '--force', dir], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
    const failure = spawnFailureMessage(
      'git',
      ['worktree', 'remove', '--force', dir],
      repoRoot,
      result,
    );
    if (failure != null) {
      console.error(`[api-docs] ${failure}`);
    }
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`Cannot parse JSON ${path}: ${error.message}`);
  }
}

function readTsConfig(path) {
  const parsed = ts.parseConfigFileTextToJson(path, readFileSync(path, 'utf8'));
  if (parsed.error != null) {
    const message = ts.flattenDiagnosticMessageText(
      parsed.error.messageText,
      '\n',
    );
    fail(`Cannot parse ${path}: ${message}`);
  }
  return parsed.config;
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function fail(message) {
  throw new Error(`[${generation.docsVersionLabel}] ${message}`);
}

function sourceFile(path, content) {
  return ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
}

function assertSourceRoot(sourceDir) {
  if (!existsSync(join(sourceDir, 'src/index.ts'))) {
    fail(`Source directory does not look like graphql-js root: ${sourceDir}`);
  }
}

function sourceMajorVersion(sourceDir) {
  const version = readJson(join(sourceDir, 'package.json')).version;
  const match = typeof version === 'string' ? /^(\d+)\./.exec(version) : null;
  if (match == null) {
    fail(`Cannot infer major version from package version: ${version}`);
  }
  return Number(match[1]);
}

function configureGeneration(ref, dir) {
  generation = {
    docsVersionLabel: ref,
  };
  assertSourceRoot(dir);

  const majorVersion = sourceMajorVersion(dir);
  const apiVersion = `api-v${majorVersion}`;
  generation = {
    apiVersion,
    docsBasePath: `/${apiVersion}`,
    docsVersionLabel: apiVersion,
    jsonPath: join(tmpDir, `${apiVersion}.json`),
    majorVersion,
    outputDir: join(websiteDir, `pages/${apiVersion}`),
    sourceDir: dir,
    tmpSourceDir: join(tmpDir, `${apiVersion}-source`),
    typedocOptionsPath: join(tmpDir, `${apiVersion}-typedoc.json`),
  };
  return majorVersion;
}

function walkFiles(dir, fn) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name),
  );
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(path, fn);
    } else if (entry.isFile()) {
      fn(path);
    }
  }
}

function collectRootExportNames(sourceRootDir) {
  // The root package page documents only declarations exported from files
  // directly under src/. Submodule re-exports are documented on submodule pages.
  const path = join(sourceRootDir, 'src/index.ts');
  const ast = sourceFile(path, readFileSync(path, 'utf8'));
  const names = new Set();

  for (const statement of ast.statements) {
    if (ts.isExportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier;
      if (
        specifier == null ||
        !ts.isStringLiteral(specifier) ||
        !isRootSpecifier(specifier.text) ||
        !statement.exportClause ||
        !ts.isNamedExports(statement.exportClause)
      ) {
        continue;
      }
      for (const element of statement.exportClause.elements) {
        names.add((element.propertyName ?? element.name).text);
      }
      continue;
    }

    if (isExported(statement)) {
      const name = statement.name?.text;
      if (name != null) {
        names.add(name);
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            names.add(declaration.name.text);
          }
        }
      }
    }
  }

  return names;
}

function emptySourceMetadata() {
  return {
    defaultValuesByRef: new Map(),
    importsByRef: new Map(),
    typesByRef: new Map(),
  };
}

function emptyDocsIndex() {
  return {
    docsById: new Map(),
    docsBySymbol: new Map(),
    typeParameterDefaultsById: new Map(),
  };
}

function emptyRenderContext() {
  return {
    docsBasePath: '',
    docsIndex: emptyDocsIndex(),
    reflectionsById: new Map(),
  };
}

function emptySourceContext() {
  return {
    metadata: emptySourceMetadata(),
    rootExportNames: new Set(),
  };
}

function collectSourceMetadata(sourceRootDir) {
  const metadata = emptySourceMetadata();
  walkFiles(join(sourceRootDir, 'src'), (path) => {
    if (!path.endsWith('.ts')) {
      return;
    }

    const ast = sourceFile(path, readFileSync(path, 'utf8'));
    const packagePath = path.slice(sourceRootDir.length + 1);

    for (const statement of ast.statements) {
      collectTypeDefinition(metadata, statement, packagePath);
      collectImportedTypes(
        metadata,
        sourceRootDir,
        path,
        statement,
        packagePath,
      );
      collectDeclarationDefaults(metadata, statement, packagePath);
    }
  });

  return metadata;
}

function analyzeSourceSnapshot(sourceRootDir) {
  return {
    metadata: collectSourceMetadata(sourceRootDir),
    rootExportNames: collectRootExportNames(sourceRootDir),
  };
}

function collectTypeDefinition(metadata, statement, packagePath) {
  if (
    (ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)) &&
    statement.name != null
  ) {
    metadata.typesByRef.set(sourceTypeKey(packagePath, statement.name.text), {
      isPublic: isExported(statement) || hasJSDocTag(statement, 'public'),
      packagePath,
      node: statement,
    });
  }
}

function collectImportedTypes(
  metadata,
  sourceRootDir,
  path,
  statement,
  packagePath,
) {
  if (!ts.isImportDeclaration(statement)) {
    return;
  }

  const targetPackagePath = importPackagePath(sourceRootDir, path, statement);
  const bindings = statement.importClause?.namedBindings;
  if (
    targetPackagePath == null ||
    bindings == null ||
    !ts.isNamedImports(bindings)
  ) {
    return;
  }

  for (const element of bindings.elements) {
    metadata.importsByRef.set(sourceTypeKey(packagePath, element.name.text), {
      packagePath: targetPackagePath,
      qualifiedName: (element.propertyName ?? element.name).text,
    });
  }
}

function collectDeclarationDefaults(metadata, statement, packagePath) {
  if (ts.isFunctionDeclaration(statement) && statement.name != null) {
    collectParameterDefaults(
      metadata,
      packagePath,
      statement.name.text,
      statement,
    );
    return;
  }

  if (!ts.isClassDeclaration(statement) || statement.name == null) {
    return;
  }

  for (const member of statement.members) {
    if (ts.isConstructorDeclaration(member)) {
      collectParameterDefaults(
        metadata,
        packagePath,
        statement.name.text,
        member,
      );
    } else if (ts.isMethodDeclaration(member)) {
      const name = propertyNameText(member.name);
      if (name != null) {
        collectParameterDefaults(metadata, packagePath, name, member);
      }
    }
  }
}

function importPackagePath(sourceRootDir, path, statement) {
  if (!ts.isStringLiteral(statement.moduleSpecifier)) {
    return null;
  }

  const specifier = statement.moduleSpecifier.text;
  if (!specifier.startsWith('.')) {
    return null;
  }

  const resolvedPath = resolve(dirname(path), specifier);
  const candidates = [`${resolvedPath}.ts`, join(resolvedPath, 'index.ts')];
  const targetPath = candidates.find((candidate) => existsSync(candidate));
  return targetPath == null ? null : targetPath.slice(sourceRootDir.length + 1);
}

function collectParameterDefaults(
  metadata,
  packagePath,
  declarationName,
  declaration,
) {
  for (const parameter of declaration.parameters ?? []) {
    if (!ts.isIdentifier(parameter.name) || parameter.initializer == null) {
      continue;
    }
    metadata.defaultValuesByRef.set(
      sourceDefaultKey(packagePath, declarationName, parameter.name.text),
      parameter.initializer.getText(),
    );
  }
}

function propertyNameText(name) {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
}

function hasJSDocTag(node, tagName) {
  return ts
    .getJSDocTags(node)
    .some((jsDocTag) => jsDocTag.tagName.text === tagName);
}

function sourceTypeKey(packagePath, qualifiedName) {
  return `${packagePath}:${qualifiedName}`;
}

function sourceDefaultKey(packagePath, declarationName, parameterName) {
  return `${packagePath}:${declarationName}:${parameterName}`;
}

function isRootSpecifier(specifier) {
  return specifier.startsWith('./') && !specifier.slice(2).includes('/');
}

function writeMeta(dir, entries) {
  const content = [
    'const meta = {',
    entries.map(metaEntry).join('\n'),
    '};',
    '',
    'export default meta;',
    '',
  ].join('\n');

  writeFileSync(join(dir, '_meta.ts'), content);
}

function metaEntry([key, value]) {
  const property = metaKey(key);

  if (typeof value === 'string') {
    return `  ${property}: '${value}',`;
  }

  return [
    `  ${property}: {`,
    `    title: '${value.title}',`,
    `    href: '${value.href}',`,
    '  },',
  ].join('\n');
}

function metaKey(value) {
  return /^[A-Za-z_$][\w$]*$/.test(value) ? value : `'${value}'`;
}

function slug(text) {
  return text
    .replace(/\\/g, '')
    .replace(/`|\(\)$/g, '')
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function commentBlockTag(comment, name) {
  return comment?.blockTags?.find((block) => block.tag === name);
}

function hasCommentTag(comment, name) {
  return (
    comment?.modifierTags?.includes(name) === true ||
    comment?.blockTags?.some((block) => block.tag === name) === true
  );
}

function hasReflectionTag(node, name) {
  return (
    hasCommentTag(node.comment, name) ||
    node.signatures?.some((signature) =>
      hasCommentTag(signature.comment, name),
    ) === true
  );
}

function tagText(comment, name, options) {
  const block = commentBlockTag(comment, name);
  return block == null ? '' : renderParts(block.content, options).trim();
}

function defaultText(node, parent, options = {}) {
  const value = rawDefaultValue(node, parent, options);
  return value == null ? '' : apiCode(value);
}

function rawDefaultValue(node, parent, options = {}) {
  return (
    sourceDefaultValue(node, parent, options) ??
    (node.defaultValue == null || node.defaultValue === '...'
      ? null
      : node.defaultValue)
  );
}

function sourceDefaultValue(node, parent, options = {}) {
  if (
    node.kind !== ReflectionKind.Parameter ||
    parent?.name == null ||
    node?.name == null
  ) {
    return null;
  }
  if (options.sourcePackagePath == null) {
    return null;
  }
  return (
    sourceContext.metadata.defaultValuesByRef.get(
      sourceDefaultKey(options.sourcePackagePath, parent.name, node.name),
    ) ?? null
  );
}

function summary(node) {
  return renderParts(node.comment?.summary ?? [], {
    linkCodeSpans: true,
  }).trim();
}

function directCategory(node) {
  const declaration = documentationNode(node);
  return (
    tagText(node.comment, '@category') ||
    tagText(node.signatures?.[0]?.comment, '@category') ||
    (declaration === node
      ? ''
      : tagText(declaration.comment, '@category') ||
        tagText(declaration.signatures?.[0]?.comment, '@category')) ||
    null
  );
}

function resolveItemCategory(node, siblings = []) {
  const declaration = documentationNode(node);
  const ownCategory = directCategory(node);
  if (ownCategory != null && ownCategory !== '') {
    return ownCategory;
  }

  if (isEnumNamespace(declaration)) {
    return commonCategory(enumLikeMembers(declaration).map(directCategory));
  }

  for (const sibling of documentationSiblings(siblings)) {
    if (sibling === declaration || sibling.name !== declaration.name) {
      continue;
    }
    const siblingCategory = directCategory(sibling);
    if (siblingCategory != null) {
      return siblingCategory;
    }
  }
  return null;
}

function commonCategory(categories) {
  const visibleCategories = categories.filter(Boolean);
  if (visibleCategories.length === 0) {
    return null;
  }
  const [first] = visibleCategories;
  return visibleCategories.every((item) => item === first) ? first : null;
}

function sanitizeTsConfig(tsconfig) {
  const compilerOptions = tsconfig.compilerOptions ?? {};
  delete compilerOptions.importsNotUsedAsValues;
  delete compilerOptions.rewriteRelativeImportExtensions;
  delete compilerOptions.erasableSyntaxOnly;
  if (Array.isArray(compilerOptions.lib)) {
    compilerOptions.lib = compilerOptions.lib.map((lib) =>
      String(lib).toLowerCase() === 'es2024' ? 'esnext' : lib,
    );
  }
  return tsconfig;
}

function renderParts(parts, options = {}) {
  return parts
    .map((part) => {
      if (part.kind === 'code') {
        return options.linkCodeSpans ? linkCodeSpan(part.text) : part.text;
      }
      return part.text ?? '';
    })
    .join('');
}

function linkCodeSpan(value) {
  const symbol = inlineCodeText(value);
  const doc = symbol == null ? null : singleSymbolDoc(symbol);
  if (doc == null) {
    return value;
  }

  return `[${code(symbol)}](${docHref(doc)})`;
}

function inlineCodeText(value) {
  const text = String(value);
  return text.startsWith('`') && text.endsWith('`') && !text.includes('\n')
    ? text.slice(1, -1)
    : null;
}

function targetDoc(target) {
  return renderContext.docsIndex.docsById.get(target) ?? null;
}

function singleSymbolDoc(symbol) {
  const docs = renderContext.docsIndex.docsBySymbol.get(symbol);
  return docs?.length === 1 ? docs[0] : null;
}

function docHref(doc) {
  return `${renderContext.docsBasePath}/${doc.page}${
    doc.anchor == null ? '' : `#${doc.anchor}`
  }`;
}

function heading(level, label) {
  return `${'#'.repeat(level)} ${label}`;
}

function isDeprecated(node) {
  const declaration = documentationNode(node);
  return (
    hasCommentTag(node?.comment, '@deprecated') ||
    (declaration !== node && hasCommentTag(declaration?.comment, '@deprecated'))
  );
}

function deprecatedTag(node) {
  return isDeprecated(node) ? ` ${deprecatedTagMarkup}` : '';
}

function isCallableDeprecated(node, signatures) {
  const declaration = documentationNode(node);
  const declarationSignatures = declaration.signatures ?? signatures;
  return (
    isDeprecated(node) ||
    (declarationSignatures.length === 1 &&
      isDeprecated(declarationSignatures[0]))
  );
}

function deprecatedHeadingLabel(label, deprecated) {
  return deprecated
    ? `<span className="api-deprecated-title">${jsxText(
        label,
      )}</span>${deprecatedTagMarkup}`
    : label;
}

function code(value) {
  const normalizedText = String(value).replace(/\r?\n|\r/g, ' ');
  const longestBacktickRun = Math.max(
    0,
    ...Array.from(normalizedText.matchAll(/`+/g), (match) => match[0].length),
  );
  // Markdown code spans cannot escape backticks with backslashes.
  const delimiter = '`'.repeat(longestBacktickRun + 1);
  const padding =
    normalizedText.startsWith('`') || normalizedText.endsWith('`') ? ' ' : '';
  return `${delimiter}${padding}${normalizedText}${padding}${delimiter}`;
}

function htmlText(value) {
  return String(value).replace(/[<>&]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
    }
    return char;
  });
}

function jsxText(value) {
  return String(value).replace(/[&{}<>]/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '{':
        return '&#123;';
      case '}':
        return '&#125;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
    }
    return char;
  });
}

function jsxAttribute(value) {
  return htmlText(value).replace(/"/g, '&quot;');
}

function mdxText(value) {
  return String(value).replace(/[{}<]/g, (char) => {
    switch (char) {
      case '{':
        return '&#123;';
      case '}':
        return '&#125;';
      case '<':
        return '&lt;';
    }
    return char;
  });
}

function mdxMarkdown(value) {
  return mapInlineCodeSpans(
    String(value),
    mdxText,
    (rawCode, delimiter) => `${delimiter}${rawCode}${delimiter}`,
  );
}

function table(rows) {
  if (rows.length === 0) {
    return [];
  }

  const headerCells = rows[0]
    .map((cell) => `      <th>${jsxText(cell)}</th>`)
    .join('\n');
  const bodyRows = rows
    .slice(1)
    .map((row) =>
      [
        '    <tr>',
        ...row.map((cell) => `      <td>${tableCell(cell)}</td>`),
        '    </tr>',
      ].join('\n'),
    )
    .join('\n');

  return [
    [
      '<table>',
      '  <thead>',
      '    <tr>',
      headerCells,
      '    </tr>',
      '  </thead>',
      '  <tbody>',
      bodyRows,
      '  </tbody>',
      '</table>',
    ].join('\n'),
  ];
}

function tableCell(value) {
  const cell = String(value);
  if (isApiCodeComponentMarkup(cell)) {
    return cell;
  }
  return cell
    .split(deprecatedTagMarkup)
    .map((part) => mapInlineCodeSpans(part, tableText, tableCode))
    .join(deprecatedTagMarkup);
}

function isApiCodeComponentMarkup(value) {
  return apiCodeComponents.some((component) =>
    value.startsWith(`<${component} `),
  );
}

function tableText(value) {
  return jsxText(value).replace(/\\/g, '&#92;').replace(/\n+/g, '<br />\n');
}

function jsString(value) {
  return JSON.stringify(value)
    .replace(/\|/g, '\\u007c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function jsxCode(value) {
  return `<code>{${jsString(value)}}</code>`;
}

function tableCode(rawCode) {
  const value = normalizeCodeSpan(rawCode);
  return jsxCode(value);
}

function normalizeCodeSpan(value) {
  const text = value.replace(/\r?\n|\r/g, ' ');
  return text.startsWith(' ') &&
    text.endsWith(' ') &&
    /\S/.test(text.slice(1, -1))
    ? text.slice(1, -1)
    : text;
}

function mapInlineCodeSpans(value, textFn, codeFn) {
  let result = '';
  let index = 0;

  while (index < value.length) {
    const start = value.indexOf('`', index);
    if (start === -1) {
      result += textFn(value.slice(index));
      break;
    }

    const delimiter = /^`+/.exec(value.slice(start))[0];
    const end = value.indexOf(delimiter, start + delimiter.length);
    if (end === -1) {
      result += textFn(value.slice(index));
      break;
    }

    result += textFn(value.slice(index, start));
    result += codeFn(value.slice(start + delimiter.length, end), delimiter);
    index = end + delimiter.length;
  }

  return result;
}

function targetId(type) {
  return typeof type.target === 'number'
    ? type.target
    : typeof type.target?.id === 'number'
      ? type.target.id
      : null;
}

function isReflectionReference(node) {
  return (
    node?.kind === ReflectionKind.Reference && node.variant === 'reference'
  );
}

function documentationNode(node) {
  let current = node;
  const seen = new Set();

  while (isReflectionReference(current)) {
    const target = targetId(current);
    if (target == null || seen.has(target)) {
      break;
    }

    const next = renderContext.reflectionsById.get(target);
    if (next == null) {
      break;
    }

    seen.add(target);
    current = next;
  }

  return current;
}

function documentationSiblings(siblings) {
  return siblings.map(documentationNode);
}

function rawTypeName(type) {
  return typeName(type, { keepDefaultTypeArguments: true });
}

function typeArguments(type, options) {
  const args = type.typeArguments ?? [];
  const target = targetId(type);
  const defaults =
    target == null
      ? null
      : renderContext.docsIndex.typeParameterDefaultsById.get(target);
  if (options.keepDefaultTypeArguments || defaults == null) {
    return args;
  }

  let end = args.length;
  while (end > 0) {
    const defaultType = defaults[end - 1];
    if (
      defaultType == null ||
      rawTypeName(args[end - 1]) !== rawTypeName(defaultType)
    ) {
      break;
    }
    end--;
  }
  return args.slice(0, end);
}

function referenceName(type) {
  return type.name ?? type.qualifiedName;
}

function typeName(type, options = {}) {
  if (type == null) {
    return 'unknown';
  }

  switch (type.type) {
    case 'array':
      return `${arrayElementTypeName(type.elementType, options)}[]`;
    case 'conditional':
      return `${typeName(type.checkType, options)} extends ${typeName(
        type.extendsType,
        options,
      )} ? ${typeName(type.trueType, options)} : ${typeName(
        type.falseType,
        options,
      )}`;
    case 'indexedAccess':
      return `${typeName(type.objectType, options)}[${typeName(
        type.indexType,
        options,
      )}]`;
    case 'inferred':
    case 'intrinsic':
      return type.name;
    case 'intersection':
      return type.types.map((item) => typeName(item, options)).join(' & ');
    case 'literal':
      return JSON.stringify(type.value);
    case 'mapped':
      return 'mapped object';
    case 'optional':
      return `${typeName(type.elementType, options)}?`;
    case 'predicate':
      return type.asserts
        ? `asserts ${type.name}`
        : `${type.name} is ${typeName(type.targetType, options)}`;
    case 'query':
      return `typeof ${typeName(type.queryType, options)}`;
    case 'reference': {
      const expanded = sourceTypeEquivalent(type, options);
      if (expanded != null) {
        return expanded;
      }
      const args = typeArguments(type, options);
      const typeArgs =
        args.length === 0
          ? ''
          : `<${args.map((arg) => typeName(arg, options)).join(', ')}>`;
      return `${referenceName(type)}${typeArgs}`;
    }
    case 'reflection':
      return reflectionType(type.declaration, options);
    case 'rest':
      return `...${typeName(type.elementType, options)}`;
    case 'templateLiteral':
      return 'template literal';
    case 'tuple':
      return `[${type.elements
        .map((item) => typeName(item, options))
        .join(', ')}]`;
    case 'typeOperator':
      if (type.operator === 'readonly' && type.target?.type === 'array') {
        return `readonly ${arrayElementTypeName(
          type.target.elementType,
          options,
        )}[]`;
      }
      return `${type.operator} ${typeName(type.target, options)}`;
    case 'union':
      return type.types.map((item) => typeName(item, options)).join(' | ');
    case 'unknown':
      return 'unknown';
  }
  return type.name ?? type.type ?? 'unknown';
}

function sourceTypeEquivalent(type, options = {}) {
  const qualifiedName = type.target?.qualifiedName ?? type.qualifiedName;
  const packagePath = options.sourcePackagePath;
  if (qualifiedName == null || packagePath == null) {
    return null;
  }
  const renderedTypeArguments = (type.typeArguments ?? []).map((arg) =>
    typeName(arg, options),
  );
  return sourceTypeName(
    packagePath,
    qualifiedName,
    options,
    renderedTypeArguments,
  );
}

function sourceTypeName(
  packagePath,
  qualifiedName,
  options = {},
  typeArgs = [],
) {
  if (options.typeSubstitutions?.has(qualifiedName) && typeArgs.length === 0) {
    return options.typeSubstitutions.get(qualifiedName);
  }

  const key = sourceTypeKey(packagePath, qualifiedName);
  const seen = options.seenSourceTypes ?? new Set();
  if (seen.has(key)) {
    return null;
  }

  const importedType = sourceContext.metadata.importsByRef.get(key);
  if (importedType != null) {
    return sourceTypeName(
      importedType.packagePath,
      importedType.qualifiedName,
      {
        ...options,
        seenSourceTypes: new Set([...seen, key]),
      },
      typeArgs,
    );
  }

  const definition = sourceContext.metadata.typesByRef.get(key);
  if (definition == null || definition.isPublic) {
    return null;
  }

  const typeSubstitutions = new Map(options.typeSubstitutions);
  for (const [index, parameter] of (
    definition.node.typeParameters ?? []
  ).entries()) {
    const typeArgument = typeArgs[index];
    if (typeArgument != null) {
      typeSubstitutions.set(parameter.name.text, typeArgument);
    }
  }
  const nextOptions = {
    ...options,
    seenSourceTypes: new Set([...seen, key]),
    typeSubstitutions,
  };
  const { node } = definition;
  if (ts.isInterfaceDeclaration(node)) {
    return interfaceTypeName(node, definition.packagePath, nextOptions);
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return renderSourceTypeNode(node.type, definition.packagePath, nextOptions);
  }
  return null;
}

function interfaceTypeName(node, packagePath, options) {
  const members = node.members
    .map((member) => interfaceMemberTypeName(member, packagePath, options))
    .filter(Boolean);
  return objectTypeName(members);
}

function renderSourceTypeNode(node, packagePath, options) {
  return typeNodeName(node, packagePath, options);
}

function objectTypeName(members) {
  return members.length === 0 ? 'object' : `{ ${members.join('; ')} }`;
}

function interfaceMemberTypeName(member, packagePath, options) {
  if (ts.isIndexSignatureDeclaration(member)) {
    const parameter = member.parameters[0];
    if (parameter?.type == null || member.type == null) {
      return null;
    }
    const parameterType = renderSourceTypeNode(
      parameter.type,
      packagePath,
      options,
    );
    const type = renderSourceTypeNode(member.type, packagePath, options);
    return indexSignatureText(
      hasReadonlyModifier(member),
      parameter.name.getText(),
      parameterType,
      type,
    );
  }

  if (ts.isPropertySignature(member) && member.type != null) {
    const name = propertyNameText(member.name);
    if (name == null) {
      return null;
    }
    const type = renderSourceTypeNode(member.type, packagePath, options);
    return `${name}${member.questionToken == null ? '' : '?'}: ${type}`;
  }

  return null;
}

function typeLiteralIndexSignature(signature, options = {}) {
  const param = signature.parameters?.[0];
  if (param == null) {
    return null;
  }
  return indexSignatureText(
    hasReadonlyFlag(signature),
    param.name,
    typeName(param.type, options),
    typeName(signature.type, options),
  );
}

function indexSignatureText(isReadonly, name, parameterType, valueType) {
  const readonlyText = isReadonly ? 'readonly ' : '';
  return `${readonlyText}[${name}: ${parameterType}]: ${valueType}`;
}

function hasReadonlyFlag(node) {
  return node.flags?.isReadonly === true;
}

function hasReadonlyModifier(node) {
  return (
    node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
    ) === true
  );
}

function indexSignatures(node) {
  return [
    node?.indexSignature,
    ...(node?.indexSignatures ?? []),
    ...(node?.children ?? []).filter(
      (child) => child.kind === ReflectionKind.IndexSignature,
    ),
  ].filter(Boolean);
}

function typeNodeName(node, packagePath, options) {
  if (ts.isArrayTypeNode(node)) {
    const element = typeNodeName(node.elementType, packagePath, options);
    return ts.isUnionTypeNode(node.elementType) ||
      ts.isIntersectionTypeNode(node.elementType)
      ? `(${element})[]`
      : `${element}[]`;
  }
  if (ts.isFunctionTypeNode(node)) {
    const params = node.parameters
      .map(
        (param) =>
          `${param.name.getText()}${param.questionToken == null ? '' : '?'}: ${
            param.type == null
              ? 'unknown'
              : typeNodeName(param.type, packagePath, options)
          }`,
      )
      .join(', ');
    return `(${params}) => ${typeNodeName(node.type, packagePath, options)}`;
  }
  if (ts.isLiteralTypeNode(node)) {
    return node.literal.getText();
  }
  if (ts.isParenthesizedTypeNode(node)) {
    return `(${typeNodeName(node.type, packagePath, options)})`;
  }
  if (ts.isTypeLiteralNode(node)) {
    return interfaceTypeName(node, packagePath, options);
  }
  if (ts.isTypeOperatorNode(node)) {
    return `${
      node.operator === ts.SyntaxKind.ReadonlyKeyword
        ? 'readonly'
        : node.operator
    } ${typeNodeName(node.type, packagePath, options)}`;
  }
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText();
    const typeArgs = (node.typeArguments ?? []).map((arg) =>
      typeNodeName(arg, packagePath, options),
    );
    const expanded = sourceTypeName(packagePath, name, options, typeArgs);
    const typeArgsText =
      typeArgs.length === 0 ? '' : `<${typeArgs.join(', ')}>`;
    return expanded ?? `${name}${typeArgsText}`;
  }
  if (ts.isTupleTypeNode(node)) {
    return `[${node.elements
      .map((element) => typeNodeName(element, packagePath, options))
      .join(', ')}]`;
  }
  if (ts.isUnionTypeNode(node)) {
    return node.types
      .map((item) => typeNodeName(item, packagePath, options))
      .join(' | ');
  }
  if (ts.isIntersectionTypeNode(node)) {
    return node.types
      .map((item) => typeNodeName(item, packagePath, options))
      .join(' & ');
  }

  return node.getText();
}

function signatureText(value) {
  return jsxText(value);
}

function signatureToken(value, kind) {
  return `<span class="api-signature-${kind}">${jsxText(value)}</span>`;
}

function signatureKeyword(value) {
  return signatureToken(value, 'keyword');
}

function signatureName(value) {
  return signatureToken(value, 'name');
}

function signatureTypeToken(value) {
  return signatureToken(value, 'type');
}

function signatureParameter(value) {
  return signatureToken(value, 'parameter');
}

function signatureProperty(value) {
  return signatureToken(value, 'property');
}

function signatureLiteralToken(value) {
  return signatureToken(value, 'literal');
}

function signatureLink(label, href) {
  return `<a class="api-signature-type" href="${jsxAttribute(href)}">${jsxText(
    label,
  )}</a>`;
}

function signaturePartsExpression(value) {
  const parts = parseSignatureParts(String(value));
  if (parts.length === 0) {
    return '[]';
  }
  return `[${parts.map(signaturePartExpression).join(', ')}]`;
}

function signaturePartExpression(part) {
  if (typeof part === 'string') {
    return jsPropString(part);
  }
  if (part.kind === 'link') {
    return `[${jsPropString('link')}, ${jsPropString(
      part.value,
    )}, ${jsPropString(part.href)}]`;
  }
  return `[${jsPropString(part.kind)}, ${jsPropString(part.value)}]`;
}

function jsPropString(value) {
  return jsString(value).replace(/[<>{}]/g, (char) => {
    switch (char) {
      case '<':
        return '\\u003c';
      case '>':
        return '\\u003e';
      case '{':
        return '\\u007b';
      case '}':
        return '\\u007d';
    }
    return char;
  });
}

function parseSignatureParts(value) {
  const parts = [];
  let position = 0;
  while (position < value.length) {
    if (value.startsWith('<span class="api-signature-', position)) {
      position = readSignatureSpan(value, position, parts);
      continue;
    }
    if (value.startsWith('<a class="api-signature-type" href="', position)) {
      position = readSignatureLink(value, position, parts);
      continue;
    }

    const nextTag = minPositiveIndex(
      value.indexOf('<span class="api-signature-', position),
      value.indexOf('<a class="api-signature-type" href="', position),
    );
    const end = nextTag ?? value.length;
    pushSignatureTextPart(parts, value.slice(position, end));
    position = end;
  }
  return parts;
}

function minPositiveIndex(...indexes) {
  const positiveIndexes = indexes.filter((index) => index >= 0);
  return positiveIndexes.length === 0 ? null : Math.min(...positiveIndexes);
}

function readSignatureSpan(value, position, parts) {
  const start = /^<span class="api-signature-([a-z]+)">/.exec(
    value.slice(position),
  );
  if (start == null) {
    fail(`Cannot parse API signature span: ${value.slice(position)}`);
  }
  const contentStart = position + start[0].length;
  const contentEnd = value.indexOf('</span>', contentStart);
  if (contentEnd === -1) {
    fail(`Unclosed API signature span: ${value.slice(position)}`);
  }
  parts.push({
    kind: start[1],
    value: decodeSignatureHtml(value.slice(contentStart, contentEnd)),
  });
  return contentEnd + '</span>'.length;
}

function readSignatureLink(value, position, parts) {
  const prefix = '<a class="api-signature-type" href="';
  const hrefStart = position + prefix.length;
  const hrefEnd = value.indexOf('">', hrefStart);
  if (hrefEnd === -1) {
    fail(`Cannot parse API signature link: ${value.slice(position)}`);
  }
  const contentStart = hrefEnd + 2;
  const contentEnd = value.indexOf('</a>', contentStart);
  if (contentEnd === -1) {
    fail(`Unclosed API signature link: ${value.slice(position)}`);
  }
  parts.push({
    kind: 'link',
    href: decodeSignatureHtml(value.slice(hrefStart, hrefEnd)),
    value: decodeSignatureHtml(value.slice(contentStart, contentEnd)),
  });
  return contentEnd + '</a>'.length;
}

function pushSignatureTextPart(parts, value) {
  const textPart = decodeSignatureHtml(value);
  if (textPart.length === 0) {
    return;
  }
  const previousPart = parts.at(-1);
  if (typeof previousPart === 'string') {
    parts[parts.length - 1] = previousPart + textPart;
  } else {
    parts.push(textPart);
  }
}

function decodeSignatureHtml(value) {
  return value.replace(
    /&(?:#(\d+)|#x([0-9a-fA-F]+)|amp|apos|gt|lt|quot);/g,
    (entity, decimal, hexadecimal) => {
      if (decimal != null) {
        return String.fromCodePoint(Number(decimal));
      }
      if (hexadecimal != null) {
        return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      }
      switch (entity) {
        case '&amp;':
          return '&';
        case '&apos;':
          return "'";
        case '&gt;':
          return '>';
        case '&lt;':
          return '<';
        case '&quot;':
          return '"';
      }
      return entity;
    },
  );
}

function apiSignature(value) {
  return `<ApiSignature parts={${signaturePartsExpression(value)}} />`;
}

function apiCode(value) {
  return `<ApiType parts={${signaturePartsExpression(
    renderSignatureCode(value),
  )}} />`;
}

function renderSignatureCode(value) {
  return renderScannedSignatureSource(String(value), renderSignatureToken);
}

function renderSignatureToken(token, tokenText) {
  if (isKeywordToken(token) || keywordLikeIdentifier(token, tokenText)) {
    return signatureKeyword(tokenText);
  }
  if (isLiteralToken(token)) {
    return signatureLiteralToken(tokenText);
  }
  return signatureText(tokenText);
}

function renderScannedSignatureSource(source, renderToken) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source,
  );
  let result = '';
  let position = 0;
  let atLineStart = true;

  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    const tokenStart = scanner.getTokenPos();
    const tokenEnd = scanner.getTextPos();
    const tokenText = scanner.getTokenText();
    result += signatureSourceText(source.slice(position, tokenStart));
    result +=
      renderLeadingWhitespaceToken(token, tokenText, atLineStart) ??
      renderToken(token, tokenText, atLineStart);
    atLineStart =
      token === ts.SyntaxKind.NewLineTrivia ||
      (atLineStart && token === ts.SyntaxKind.WhitespaceTrivia);
    position = tokenEnd;
  }

  return result + signatureSourceText(source.slice(position));
}

function renderLeadingWhitespaceToken(token, tokenText, atLineStart) {
  if (atLineStart && token === ts.SyntaxKind.WhitespaceTrivia) {
    return tokenText.replace(/ /g, '&#32;').replace(/\t/g, '&#32;&#32;');
  }
  return null;
}

function createSignatureSourceContext(options = {}) {
  return {
    ...options,
    seenSourceTypes: options.seenSourceTypes ?? new Set(),
    state: {
      nextPlaceholderId: 0,
      placeholders: new Map(),
    },
    typeSubstitutions: options.typeSubstitutions ?? new Map(),
  };
}

function withSignatureSourceContext(ctx, overrides) {
  return {
    ...ctx,
    ...overrides,
    state: ctx.state,
  };
}

function signaturePlaceholder(ctx, html) {
  const placeholder = `__API_SIGNATURE_${ctx.state.nextPlaceholderId++}__`;
  ctx.state.placeholders.set(placeholder, html);
  return placeholder;
}

function signatureNameSource(ctx, name) {
  return signaturePlaceholder(ctx, signatureName(name));
}

function signatureTypeTokenSource(ctx, name) {
  return signaturePlaceholder(ctx, signatureTypeToken(name));
}

function signatureParameterSource(ctx, name) {
  return signaturePlaceholder(ctx, signatureParameter(name));
}

function signaturePropertySource(ctx, name) {
  return signaturePlaceholder(ctx, signatureProperty(name));
}

function signatureTypeLinkSource(ctx, label, target) {
  const doc = targetDoc(target);
  return signaturePlaceholder(
    ctx,
    doc == null
      ? signatureTypeToken(label)
      : signatureLink(label, docHref(doc)),
  );
}

function signatureSourceTypeLink(ctx, name) {
  const doc = singleSymbolDoc(name);
  return signaturePlaceholder(
    ctx,
    doc == null ? signatureTypeToken(name) : signatureLink(name, docHref(doc)),
  );
}

function formatSignatureSource(source) {
  try {
    return prettier.format(source, signaturePrettierOptions).trimEnd();
  } catch (error) {
    fail(`Cannot format API signature source:\n${source}\n\n${error.message}`);
  }
}

function renderFormattedSignatureSource(source, ctx) {
  return renderScannedSignatureSource(source, (token, tokenText) =>
    renderFormattedSignatureToken(token, tokenText, ctx),
  );
}

function renderFormattedSignatureToken(token, tokenText, ctx) {
  const placeholder = ctx.state.placeholders.get(tokenText);
  if (placeholder != null) {
    return placeholder;
  }
  return renderSignatureToken(token, tokenText);
}

function signatureSourceText(value) {
  return signatureText(value).replace(
    /(^|\n)( +)/g,
    (_, lineStart, spaces) => `${lineStart}${'&#32;'.repeat(spaces.length)}`,
  );
}

function formatInterfaceMemberSource(memberSource) {
  return formatDeclarationBody(
    formatSignatureSource(`interface __ApiSignature {\n${memberSource}\n}`),
  );
}

function formatClassMemberSource(memberSource) {
  return formatDeclarationBody(
    formatSignatureSource(`declare class __ApiSignature {\n${memberSource}\n}`),
  );
}

function formatDeclarationBody(source) {
  const lines = source.split('\n');
  return lines.slice(1, -1).join('\n').replace(/^ {2}/gm, '').trim();
}

function formatTypeSource(type, options = {}) {
  const ctx = createSignatureSourceContext(options);
  const source = signatureTypeSource(type, ctx);
  const formatted = formatInterfaceMemberSource(`__api(): ${source};`);
  const body = extractReturnTypeBody(formatted);
  return renderFormattedSignatureSource(body, ctx);
}

function extractReturnTypeBody(source) {
  const prefix = '__api():';
  const body = source.slice(prefix.length).replace(/;$/, '').trim();
  return body.replace(/\n {2}([|&] )/g, '\n$1');
}

function signatureTypeParametersSource(node, ctx) {
  const typeParameters = node.typeParameters ?? [];
  if (typeParameters.length === 0) {
    return '';
  }
  return `<${typeParameters
    .map((param) => signatureTypeParameterSource(param, ctx))
    .join(', ')}>`;
}

function signatureTypeParameterSource(param, ctx) {
  const constraint =
    param.type == null
      ? ''
      : ` extends ${signatureTypeSource(param.type, ctx)}`;
  const defaultType =
    param.default == null
      ? ''
      : ` = ${signatureTypeSource(param.default, ctx)}`;
  return `${signatureTypeTokenSource(
    ctx,
    param.name,
  )}${constraint}${defaultType}`;
}

function signatureParametersSource(signature, ctx, options = {}) {
  return (signature.parameters ?? [])
    .map((param) =>
      signatureParameterDeclarationSource(param, signature, ctx, options),
    )
    .join(', ');
}

function signatureParameterDeclarationSource(
  param,
  signature,
  ctx,
  options = {},
) {
  const defaultValue = options.includeDefault
    ? rawDefaultValue(param, signature, ctx)
    : null;
  return `${signatureParameterSource(ctx, param.name)}${
    param.flags?.isOptional === true ? '?' : ''
  }: ${signatureTypeSource(param.type, ctx)}${
    defaultValue == null ? '' : ` = ${defaultValue}`
  }`;
}

function signatureFunctionTypeSource(signature, ctx) {
  return `(${signatureParametersSource(
    signature,
    ctx,
  )}) => ${signatureTypeSource(signature.type, ctx)}`;
}

function signatureTypeSource(type, ctx) {
  if (type == null) {
    return 'unknown';
  }

  switch (type.type) {
    case 'array':
      return `${signatureArrayElementTypeSource(type.elementType, ctx)}[]`;
    case 'conditional':
      return `${signatureTypeSource(
        type.checkType,
        ctx,
      )} extends ${signatureTypeSource(
        type.extendsType,
        ctx,
      )} ? ${signatureTypeSource(type.trueType, ctx)} : ${signatureTypeSource(
        type.falseType,
        ctx,
      )}`;
    case 'indexedAccess':
      return `${signatureTypeSource(
        type.objectType,
        ctx,
      )}[${signatureTypeSource(type.indexType, ctx)}]`;
    case 'inferred':
    case 'intrinsic':
      return type.name;
    case 'intersection':
      return type.types
        .map((item) => signatureTypeSource(item, ctx))
        .join(' & ');
    case 'literal':
      return JSON.stringify(type.value);
    case 'mapped':
      return signatureTypeTokenSource(ctx, 'mapped object');
    case 'optional':
      return `${signatureTypeSource(type.elementType, ctx)}?`;
    case 'predicate':
      return type.asserts
        ? `asserts ${signatureParameterSource(ctx, type.name)}`
        : `${signatureParameterSource(ctx, type.name)} is ${signatureTypeSource(
            type.targetType,
            ctx,
          )}`;
    case 'query':
      return `typeof ${signatureTypeSource(type.queryType, ctx)}`;
    case 'reference': {
      const expanded = signatureSourceTypeEquivalent(type, ctx);
      if (expanded != null) {
        return expanded;
      }
      const name = referenceName(type);
      const target = targetId(type);
      const base =
        target == null
          ? signatureTypeTokenSource(ctx, name)
          : signatureTypeLinkSource(ctx, name, target);
      return `${base}${signatureTypeArgumentsSource(type, ctx)}`;
    }
    case 'reflection':
      return signatureReflectionTypeSource(type.declaration, ctx);
    case 'rest':
      return `...${signatureTypeSource(type.elementType, ctx)}`;
    case 'templateLiteral':
      return signatureTypeTokenSource(ctx, 'template literal');
    case 'tuple':
      return `[${type.elements
        .map((item) => signatureTypeSource(item, ctx))
        .join(', ')}]`;
    case 'typeOperator':
      if (type.operator === 'readonly' && type.target?.type === 'array') {
        return `readonly ${signatureArrayElementTypeSource(
          type.target.elementType,
          ctx,
        )}[]`;
      }
      return `${type.operator} ${signatureTypeSource(type.target, ctx)}`;
    case 'union':
      return type.types
        .map((item) => signatureTypeSource(item, ctx))
        .join(' | ');
    case 'unknown':
      return 'unknown';
  }
  return signatureTypeTokenSource(
    ctx,
    referenceName(type) ?? type.type ?? 'unknown',
  );
}

function signatureArrayElementTypeSource(type, ctx) {
  const source = signatureTypeSource(type, ctx);
  return type?.type === 'union' ||
    type?.type === 'intersection' ||
    (type?.type === 'reflection' && type.declaration?.signatures?.length)
    ? `(${source})`
    : source;
}

function signatureTypeArgumentsSource(type, ctx) {
  const args = typeArguments(type, ctx);
  return args.length === 0
    ? ''
    : `<${args.map((arg) => signatureTypeSource(arg, ctx)).join(', ')}>`;
}

function signatureSourceTypeEquivalent(type, ctx) {
  const qualifiedName = type.target?.qualifiedName ?? type.qualifiedName;
  const packagePath = ctx.sourcePackagePath;
  if (qualifiedName == null || packagePath == null) {
    return null;
  }
  const renderedTypeArguments = (type.typeArguments ?? []).map((arg) =>
    signatureTypeSource(arg, ctx),
  );
  return signatureSourceTypeName(
    packagePath,
    qualifiedName,
    ctx,
    renderedTypeArguments,
  );
}

function signatureSourceTypeName(
  packagePath,
  qualifiedName,
  ctx,
  renderedTypeArguments = [],
) {
  if (
    ctx.typeSubstitutions?.has(qualifiedName) &&
    renderedTypeArguments.length === 0
  ) {
    return ctx.typeSubstitutions.get(qualifiedName);
  }

  const key = sourceTypeKey(packagePath, qualifiedName);
  if (ctx.seenSourceTypes.has(key)) {
    return null;
  }

  const importedType = sourceContext.metadata.importsByRef.get(key);
  if (importedType != null) {
    return signatureSourceTypeName(
      importedType.packagePath,
      importedType.qualifiedName,
      withSignatureSourceContext(ctx, {
        seenSourceTypes: new Set([...ctx.seenSourceTypes, key]),
      }),
      renderedTypeArguments,
    );
  }

  const definition = sourceContext.metadata.typesByRef.get(key);
  if (definition == null || definition.isPublic) {
    return null;
  }

  const typeSubstitutions = new Map(ctx.typeSubstitutions);
  for (const [index, parameter] of (
    definition.node.typeParameters ?? []
  ).entries()) {
    const typeArgument = renderedTypeArguments[index];
    if (typeArgument != null) {
      typeSubstitutions.set(parameter.name.text, typeArgument);
    }
  }

  const nextCtx = withSignatureSourceContext(ctx, {
    seenSourceTypes: new Set([...ctx.seenSourceTypes, key]),
    typeSubstitutions,
  });
  const { node } = definition;
  if (ts.isInterfaceDeclaration(node)) {
    return signatureInterfaceTypeSource(node, definition.packagePath, nextCtx);
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return signatureTypeNodeSource(node.type, definition.packagePath, nextCtx);
  }
  return null;
}

function signatureInterfaceTypeSource(node, packagePath, ctx) {
  const members = node.members
    .map((member) => signatureInterfaceMemberSource(member, packagePath, ctx))
    .filter(Boolean);
  return signatureObjectTypeSource(members, ctx);
}

function signatureObjectTypeSource(members, ctx) {
  return members.length === 0
    ? signatureTypeTokenSource(ctx, 'object')
    : `{ ${members.join('; ')} }`;
}

function signatureInterfaceMemberSource(member, packagePath, ctx) {
  if (ts.isIndexSignatureDeclaration(member)) {
    const parameter = member.parameters[0];
    if (parameter?.type == null || member.type == null) {
      return null;
    }
    return signatureIndexSignatureSource(
      hasReadonlyModifier(member),
      parameter.name.getText(),
      signatureTypeNodeSource(parameter.type, packagePath, ctx),
      signatureTypeNodeSource(member.type, packagePath, ctx),
      ctx,
    );
  }

  if (ts.isPropertySignature(member) && member.type != null) {
    const name = propertyNameText(member.name);
    if (name == null) {
      return null;
    }
    return signatureTypedPropertySource(
      name,
      member.questionToken != null,
      signatureTypeNodeSource(member.type, packagePath, ctx),
      ctx,
    );
  }

  return null;
}

function signatureReflectionTypeSource(node, ctx) {
  if (node?.signatures?.length) {
    return node.signatures
      .map((signature) => `(${signatureFunctionTypeSource(signature, ctx)})`)
      .join(' | ');
  }
  const members = typeLiteralMembers(
    node,
    ctx,
    signatureTypeLiteralIndexSignatureSource,
    (child) =>
      signatureTypedPropertySource(
        child.name,
        child.flags?.isOptional === true,
        signatureTypeSource(child.type, ctx),
        ctx,
      ),
  );
  return signatureObjectTypeSource(members, ctx);
}

function signatureTypeLiteralIndexSignatureSource(signature, ctx) {
  const param = signature.parameters?.[0];
  if (param == null) {
    return null;
  }
  return signatureIndexSignatureSource(
    hasReadonlyFlag(signature),
    param.name,
    signatureTypeSource(param.type, ctx),
    signatureTypeSource(signature.type, ctx),
    ctx,
  );
}

function signatureIndexSignatureSource(
  isReadonly,
  name,
  parameterType,
  valueType,
  ctx,
) {
  return `${isReadonly ? 'readonly ' : ''}[${signatureParameterSource(
    ctx,
    name,
  )}: ${parameterType}]: ${valueType}`;
}

function signatureTypedPropertySource(name, optional, type, ctx) {
  return `${signaturePropertyNameSource(name, ctx)}${
    optional ? '?' : ''
  }: ${type}`;
}

function signaturePropertyNameSource(name, ctx) {
  return /^[A-Za-z_$][\w$]*$/.test(name)
    ? signaturePropertySource(ctx, name)
    : JSON.stringify(name);
}

function signatureTypeNodeSource(node, packagePath, ctx) {
  const keyword = typeNodeKeywordNames.get(node.kind);
  if (keyword != null) {
    return keyword;
  }
  if (ts.isArrayTypeNode(node)) {
    const element = signatureTypeNodeSource(node.elementType, packagePath, ctx);
    return ts.isUnionTypeNode(node.elementType) ||
      ts.isIntersectionTypeNode(node.elementType) ||
      ts.isFunctionTypeNode(node.elementType)
      ? `(${element})[]`
      : `${element}[]`;
  }
  if (ts.isConditionalTypeNode(node)) {
    return `${signatureTypeNodeSource(
      node.checkType,
      packagePath,
      ctx,
    )} extends ${signatureTypeNodeSource(
      node.extendsType,
      packagePath,
      ctx,
    )} ? ${signatureTypeNodeSource(
      node.trueType,
      packagePath,
      ctx,
    )} : ${signatureTypeNodeSource(node.falseType, packagePath, ctx)}`;
  }
  if (ts.isFunctionTypeNode(node)) {
    return `(${node.parameters
      .map((param) => signatureTypeNodeParameterSource(param, packagePath, ctx))
      .join(', ')}) => ${signatureTypeNodeSource(node.type, packagePath, ctx)}`;
  }
  if (ts.isIndexedAccessTypeNode(node)) {
    return `${signatureTypeNodeSource(
      node.objectType,
      packagePath,
      ctx,
    )}[${signatureTypeNodeSource(node.indexType, packagePath, ctx)}]`;
  }
  if (ts.isLiteralTypeNode(node)) {
    return node.literal.getText();
  }
  if (ts.isParenthesizedTypeNode(node)) {
    return `(${signatureTypeNodeSource(node.type, packagePath, ctx)})`;
  }
  if (ts.isTypeLiteralNode(node)) {
    return signatureInterfaceTypeSource(node, packagePath, ctx);
  }
  if (ts.isTypeOperatorNode(node)) {
    return `${
      node.operator === ts.SyntaxKind.ReadonlyKeyword
        ? 'readonly'
        : node.operator
    } ${signatureTypeNodeSource(node.type, packagePath, ctx)}`;
  }
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText();
    const typeArgs = (node.typeArguments ?? []).map((arg) =>
      signatureTypeNodeSource(arg, packagePath, ctx),
    );
    const expanded = signatureSourceTypeName(packagePath, name, ctx, typeArgs);
    const typeArgsText =
      typeArgs.length === 0 ? '' : `<${typeArgs.join(', ')}>`;
    return expanded ?? `${signatureSourceTypeLink(ctx, name)}${typeArgsText}`;
  }
  if (ts.isTupleTypeNode(node)) {
    return `[${node.elements
      .map((element) => signatureTypeNodeSource(element, packagePath, ctx))
      .join(', ')}]`;
  }
  if (ts.isUnionTypeNode(node)) {
    return node.types
      .map((item) => signatureTypeNodeSource(item, packagePath, ctx))
      .join(' | ');
  }
  if (ts.isIntersectionTypeNode(node)) {
    return node.types
      .map((item) => signatureTypeNodeSource(item, packagePath, ctx))
      .join(' & ');
  }

  return node.getText();
}

function signatureTypeNodeParameterSource(param, packagePath, ctx) {
  return `${signatureParameterSource(ctx, param.name.getText())}${
    param.questionToken == null ? '' : '?'
  }: ${
    param.type == null
      ? 'unknown'
      : signatureTypeNodeSource(param.type, packagePath, ctx)
  }`;
}

function isKeywordToken(token) {
  return (
    token >= ts.SyntaxKind.FirstKeyword && token <= ts.SyntaxKind.LastKeyword
  );
}

function keywordLikeIdentifier(token, tokenText) {
  return (
    token === ts.SyntaxKind.Identifier && keywordLikeIdentifiers.has(tokenText)
  );
}

function isLiteralToken(token) {
  return literalTokenKinds.has(token);
}

function arrayElementTypeName(type, options = {}) {
  const name = typeName(type, options);
  return type?.type === 'union' || type?.type === 'intersection'
    ? `(${name})`
    : name;
}

function reflectionType(node, options = {}) {
  if (node?.signatures?.length) {
    return node.signatures
      .map((signature) => signatureType(signature, options))
      .join(' | ');
  }
  const members = typeLiteralMembers(
    node,
    options,
    typeLiteralIndexSignature,
    (child) =>
      `${child.name}${child.flags?.isOptional ? '?' : ''}: ${typeName(
        child.type,
        options,
      )}`,
  );
  return objectTypeName(members);
}

function signatureType(signature, options = {}) {
  const params = (signature.parameters ?? [])
    .map(
      (param) =>
        `${param.name}${param.flags?.isOptional ? '?' : ''}: ${typeName(
          param.type,
          options,
        )}`,
    )
    .join(', ');
  return `(${params}): ${typeName(signature.type, options)}`;
}

function typeLiteralMembers(node, options, renderIndexSignature, renderChild) {
  return [
    ...indexSignatures(node)
      .map((signature) => renderIndexSignature(signature, options))
      .filter(Boolean),
    ...visibleChildren(node).map(renderChild),
  ];
}

function renderApiType(type, options = {}) {
  return `<ApiType parts={${signaturePartsExpression(
    formatTypeSource(type, options),
  )}} />`;
}

function renderSignatureDeclaration(
  signature,
  options = {},
  name = signature.name,
) {
  const ctx = createSignatureSourceContext(options);
  const source = `${signatureNameSource(
    ctx,
    name,
  )}${signatureTypeParametersSource(
    signature,
    ctx,
  )}(${signatureParametersSource(signature, ctx, {
    includeDefault: true,
  })}): ${signatureTypeSource(signature.type, ctx)};`;
  return apiSignature(
    renderFormattedSignatureSource(formatInterfaceMemberSource(source), ctx),
  );
}

function renderConstructorDeclaration(signature, options = {}) {
  const ctx = createSignatureSourceContext(options);
  const source = `constructor(${signatureParametersSource(signature, ctx, {
    includeDefault: true,
  })});`;
  const constructorSource = signaturePlaceholder(
    ctx,
    `${signatureKeyword('new')} ${signatureName(signature.name)}`,
  );
  return apiSignature(
    renderFormattedSignatureSource(
      formatClassMemberSource(source).replace(
        /^constructor/,
        constructorSource,
      ),
      ctx,
    ),
  );
}

function renderTypeAliasDeclaration(node, options = {}) {
  const ctx = createSignatureSourceContext(options);
  const source = `type ${signatureNameSource(
    ctx,
    node.name,
  )}${signatureTypeParametersSource(node, ctx)} = ${signatureTypeSource(
    node.type,
    ctx,
  )};`;
  return apiSignature(
    renderFormattedSignatureSource(formatSignatureSource(source), ctx),
  );
}

function declarationKind(node, siblings = []) {
  const declaration = documentationNode(node);
  const declarationSiblings = documentationSiblings(siblings);
  if (isEnumLikeDeclaration(declaration, declarationSiblings)) {
    return 'Enumerations';
  }
  if (declaration.kind === ReflectionKind.Class) {
    return 'Classes';
  }
  if (declaration.kind === ReflectionKind.Function) {
    return 'Functions';
  }
  if (declaration.kind === ReflectionKind.Variable) {
    return 'Constants';
  }
  if (declaration.kind === ReflectionKind.Enum) {
    return 'Enumerations';
  }
  if (
    declaration.kind === ReflectionKind.TypeAlias ||
    declaration.kind === ReflectionKind.Interface ||
    (declaration.kind === ReflectionKind.Reference &&
      declaration.variant === 'declaration')
  ) {
    return 'Types';
  }
  return null;
}

function isEnumLikeDeclaration(node, siblings = []) {
  const declaration = documentationNode(node);
  const declarationSiblings = documentationSiblings(siblings);
  return (
    isEnumNamespace(declaration) ||
    isEnumLikeConstObject(declaration, declarationSiblings)
  );
}

function isEnumLikeConstObject(node, siblings = []) {
  const declaration = documentationNode(node);
  const declarationSiblings = documentationSiblings(siblings);
  return (
    declaration.kind === ReflectionKind.Variable &&
    hasMatchingTypeAlias(declaration, declarationSiblings) &&
    enumLikeMembers(declaration).length > 0
  );
}

function isEnumLikeTypeAlias(node, siblings = []) {
  const declaration = documentationNode(node);
  const declarationSiblings = documentationSiblings(siblings);
  return (
    declaration.kind === ReflectionKind.TypeAlias &&
    declarationSiblings.some(
      (sibling) =>
        sibling !== declaration &&
        sibling.name === declaration.name &&
        isEnumLikeConstObject(sibling, declarationSiblings),
    )
  );
}

function hasMatchingTypeAlias(node, siblings = []) {
  return siblings.some(
    (sibling) =>
      sibling !== node &&
      sibling.name === node.name &&
      sibling.kind === ReflectionKind.TypeAlias,
  );
}

function isEnumNamespace(node) {
  if (node.kind !== ReflectionKind.Namespace) {
    return false;
  }
  const children = visibleChildren(node);
  const valueNames = new Set(
    children
      .filter((child) => child.kind === ReflectionKind.Variable)
      .map((child) => child.name),
  );
  return children.some(
    (child) =>
      child.kind === ReflectionKind.TypeAlias && valueNames.has(child.name),
  );
}

function enumLikeMembers(node) {
  if (node.kind === ReflectionKind.Namespace) {
    return visibleChildren(node).filter(
      (child) => child.kind === ReflectionKind.Variable,
    );
  }
  return visibleChildren(node.type?.declaration);
}

function visibleChildren(node, options = {}) {
  if (node == null) {
    return [];
  }

  if (options.includeReferences) {
    return (node.children ?? []).filter((child) =>
      isVisibleChild(child, options),
    );
  }

  let children = visibleChildrenCache.get(node);
  if (children == null) {
    children = (node.children ?? []).filter((child) =>
      isVisibleChild(child, options),
    );
    visibleChildrenCache.set(node, children);
  }
  return children;
}

function isVisibleChild(child, options = {}) {
  return (
    (options.includeReferences || !isReflectionReference(child)) &&
    child.kind !== ReflectionKind.IndexSignature &&
    !child.flags?.isExternal &&
    !child.flags?.isInherited &&
    !child.flags?.isPrivate &&
    !hasReflectionTag(child, '@internal') &&
    !hasReflectionTag(child, '@private')
  );
}

function renderComment(node) {
  const parts = [];

  const summaryText = summary(node);
  if (summaryText) {
    parts.push(mdxMarkdown(summaryText));
  }

  const remarks = tagText(node.comment, '@remarks', {
    linkCodeSpans: true,
  });
  if (remarks) {
    parts.push(`**Remarks:** ${mdxMarkdown(remarks)}`);
  }
  return parts.join('\n\n');
}

function renderFields(parent, level, options = {}) {
  const children = visibleChildren(parent).filter(
    (child) =>
      child.kind === ReflectionKind.Property ||
      child.kind === ReflectionKind.Method,
  );
  if (children.length === 0) {
    return [];
  }

  const lines = [];
  const rows = [];
  for (const child of children) {
    if (child.kind === ReflectionKind.Method) {
      if (rows.length > 0 || lines.length > 0) {
        lines.push('<hr className="api-subsection-divider" />');
      }
      lines.push(...renderCallable(child, level, child.name));
      continue;
    }
    const defaultValue = defaultText(child, parent, options);
    rows.push([
      `${htmlText(child.name)}${
        child.flags?.isOptional ? '?' : ''
      }${deprecatedTag(child)}`,
      renderApiType(child.type, options),
      defaultValue,
      summary(child),
    ]);
    lines.push(...renderExamples(child.comment, `${child.name} Example`));
  }
  const members = tableWithOptionalDefault(rows);
  if (rows.length === 0) {
    return lines;
  }
  return options.heading
    ? [...headingSubsection('Members', level, members), ...lines]
    : [...subsection('Members', members), ...lines];
}

function renderParams(signature, options = {}) {
  const params = signature.parameters ?? [];
  if (params.length === 0) {
    return [];
  }

  const rows = [];
  for (const param of signature.parameters ?? []) {
    const defaultValue = defaultText(param, signature, options);
    rows.push([
      `${htmlText(param.name)}${
        param.flags?.isOptional ? '?' : ''
      }${deprecatedTag(param)}`,
      renderApiType(param.type, options),
      defaultValue,
      summary(param),
    ]);
  }
  return subsection('Arguments', tableWithOptionalDefault(rows));
}

function tableWithOptionalDefault(rows) {
  const hasDefault = rows.some(([, , defaultValue]) => defaultValue !== '');
  const headers = hasDefault
    ? ['Name', 'Type', 'Default', 'Description']
    : ['Name', 'Type', 'Description'];
  const visibleRows = hasDefault
    ? rows
    : rows.map(([name, type, , description]) => [name, type, description]);
  return table([headers, ...visibleRows]);
}

function tableWithOptionalDescription(headers, rows) {
  const descriptionIndex = headers.indexOf('Description');
  if (
    descriptionIndex === -1 ||
    rows.some((row) => row[descriptionIndex] !== '')
  ) {
    return table([headers, ...rows]);
  }

  return table([
    headers.filter((_, index) => index !== descriptionIndex),
    ...rows.map((row) => row.filter((_, index) => index !== descriptionIndex)),
  ]);
}

function renderExamples(comment, title = 'Example') {
  const examples = (comment?.blockTags ?? []).filter(
    (block) => block.tag === '@example',
  );
  if (examples.length === 0) {
    return [];
  }

  return examples.flatMap((example, index) =>
    subsection(examples.length === 1 ? title : `${title} ${index + 1}`, [
      renderParts(example.content).trim(),
    ]),
  );
}

function renderReturns(signature, options = {}) {
  if (signature.type == null || typeName(signature.type, options) === 'void') {
    return [];
  }
  const returns = tagText(signature.comment, '@returns', {
    linkCodeSpans: true,
  });
  if (!returns) {
    return [];
  }
  return subsection('Returns', [
    ...table([
      ['Type', 'Description'],
      [renderApiType(signature.type, options), returns],
    ]),
  ]);
}

function renderTypeParameters(node, options = {}) {
  const typeParameters = node.typeParameters ?? [];
  if (typeParameters.length === 0) {
    return [];
  }

  const rows = typeParameters.map((param) => [
    `${param.name}${deprecatedTag(param)}`,
    param.type == null ? '' : renderApiType(param.type, options),
    param.default == null ? '' : renderApiType(param.default, options),
    summary(param),
  ]);
  return subsection('Type Parameters', [
    ...table([['Name', 'Constraint', 'Default', 'Description'], ...rows]),
  ]);
}

function publishedExtendedTypes(node) {
  if (node.kind !== ReflectionKind.Interface) {
    return [];
  }

  return (node.extendedTypes ?? []).filter((type) => {
    const target = targetId(type);
    return target != null && targetDoc(target) != null;
  });
}

function renderInterfaceDeclaration(node, options = {}) {
  const extendedTypes = publishedExtendedTypes(node);
  if (extendedTypes.length === 0) {
    return '';
  }

  const ctx = createSignatureSourceContext(options);
  const source = `interface ${signatureNameSource(
    ctx,
    node.name,
  )}${signatureTypeParametersSource(node, ctx)} extends ${extendedTypes
    .map((type) => signatureTypeSource(type, ctx))
    .join(', ')} {}`;
  return apiSignature(
    renderFormattedSignatureSource(
      formatSignatureSource(source).replace(/\s*\{\}$/, ''),
      ctx,
    ),
  );
}

function renderCallable(
  node,
  level,
  label = `${node.name}()`,
  options = sourceOptions(node),
) {
  const signatures = node.signatures ?? [node];
  const headingLabel = label.endsWith(')') ? label : `${label}()`;
  const lines = [
    heading(
      level,
      deprecatedHeadingLabel(
        headingLabel,
        isCallableDeprecated(node, signatures),
      ),
    ),
  ];

  for (const [index, signature] of signatures.entries()) {
    const overloadLabel =
      signatures.length > 1 ? `Overload ${index + 1}` : null;
    if (overloadLabel) {
      lines.push(
        ...subsection(`${overloadLabel}${deprecatedTag(signature)}`, []),
      );
    }

    const comment = renderComment(signature);
    if (comment) {
      lines.push(comment);
    }
    lines.push(...renderTypeParameters(signature, options));
    lines.push(
      '**Signature:**',
      renderSignatureDeclaration(signature, options),
    );
    lines.push(...renderParams(signature, options));
    lines.push(...renderReturns(signature, options));
    lines.push(...renderExamples(signature.comment));
  }
  return lines;
}

function renderDeclaration(node, level = 3, siblings = []) {
  const declaration = documentationNode(node);
  if (declaration !== node) {
    return renderDeclaration(
      declaration,
      level,
      documentationSiblings(siblings),
    );
  }

  const lines = [];
  const options = sourceOptions(node);
  const title =
    node.kind === ReflectionKind.Function ? `${node.name}()` : node.name;

  if (node.kind === ReflectionKind.Function) {
    return renderCallable(node, level, title, options);
  }

  lines.push(heading(level, deprecatedHeadingLabel(title, isDeprecated(node))));

  const comment = renderComment(node);
  const label = typeLabel(node, siblings);
  if (label != null) {
    lines.push(comment ? `**${label}.** ${comment}` : `**${label}.**`);
  } else if (comment) {
    lines.push(comment);
  }

  lines.push(...renderTypeParameters(node, options));
  const examples = renderExamples(node.comment);

  if (isEnumLikeDeclaration(node, siblings)) {
    lines.push(enumLikeNote(node));
    lines.push(...examples);
    lines.push(...renderEnumMembers(node, options));
    return lines;
  }

  const interfaceDeclaration = renderInterfaceDeclaration(node, options);
  if (interfaceDeclaration) {
    lines.push(interfaceDeclaration);
  }

  if (node.kind === ReflectionKind.Variable) {
    lines.push(...subsection('Type', [renderApiType(node.type, options)]));
    lines.push(...examples);
    return lines;
  }

  if (
    (node.kind === ReflectionKind.TypeAlias ||
      node.kind === ReflectionKind.Reference) &&
    node.type != null
  ) {
    lines.push(renderTypeAliasDeclaration(node, options));
  }

  if (node.kind === ReflectionKind.Enum) {
    lines.push(...examples);
    const rows = visibleChildren(node).map((child) => [
      `${code(child.name)}${deprecatedTag(child)}`,
      code(typeName(child.type, options)),
      summary(child),
    ]);
    lines.push(
      ...subsection('Members', [
        ...tableWithOptionalDescription(['Name', 'Value', 'Description'], rows),
      ]),
    );
    return lines;
  }

  if (node.kind === ReflectionKind.Class) {
    lines.push(...examples);
    const constructors = visibleChildren(node).filter(
      (child) => child.kind === ReflectionKind.Constructor,
    );
    for (const constructor of constructors) {
      for (const signature of constructor.signatures ?? []) {
        lines.push(
          ...headingSubsection(
            deprecatedHeadingLabel('Constructor', isDeprecated(signature)),
            level + 1,
          ),
        );
        const signatureComment = renderComment(signature);
        if (signatureComment) {
          lines.push(signatureComment);
        }
        lines.push(
          '**Signature:**',
          renderConstructorDeclaration(signature, options),
        );
        lines.push(...renderParams(signature, options));
      }
    }
  } else {
    lines.push(...examples);
  }

  lines.push(
    ...renderFields(node, level + 1, {
      ...options,
      heading: node.kind === ReflectionKind.Class,
    }),
  );
  return lines;
}

function enumLikeNote(node) {
  const runtimeShape =
    node.kind === ReflectionKind.Namespace
      ? 'namespace object'
      : 'const object';
  return `> This is not a TypeScript ${code('enum')}. GraphQL.js exports ${code(
    node.name,
  )} as both a runtime ${runtimeShape} of literal values and a TypeScript type alias for those values.`;
}

function renderEnumMembers(node, options = {}) {
  const rows = enumLikeMembers(node).map((child) => [
    `${code(child.name)}${deprecatedTag(child)}`,
    code(typeName(child.type, options)),
    summary(child),
  ]);
  if (rows.length === 0) {
    return [];
  }
  return subsection('Members', [
    ...tableWithOptionalDescription(['Name', 'Value', 'Description'], rows),
  ]);
}

function sourceOptions(node) {
  const sourcePackagePath = sourceFileName(node);
  return sourcePackagePath == null ? {} : { sourcePackagePath };
}

function sourceFileName(node) {
  const fileName = node?.sources?.[0]?.fileName;
  if (fileName == null) {
    return null;
  }
  if (fileName.startsWith('src/')) {
    return fileName;
  }
  const srcSegment = '/src/';
  const srcIndex = fileName.lastIndexOf(srcSegment);
  return srcIndex === -1
    ? `src/${fileName.replace(/^\.\//, '')}`
    : fileName.slice(srcIndex + 1);
}

function typeLabel(node, siblings = []) {
  const declaration = documentationNode(node);
  const declarationSiblings = documentationSiblings(siblings);
  if (
    declaration.kind === ReflectionKind.Enum ||
    isEnumLikeDeclaration(declaration, declarationSiblings)
  ) {
    return 'Enumeration';
  }
  if (declaration.kind === ReflectionKind.Interface) {
    return 'Interface';
  }
  if (
    declaration.kind === ReflectionKind.TypeAlias ||
    (declaration.kind === ReflectionKind.Reference &&
      declaration.variant === 'declaration')
  ) {
    return 'Type alias';
  }
  return null;
}

function apiModuleName(module) {
  return module.name === 'index' ? 'graphql' : module.name;
}

function moduleTitle(name) {
  return name === 'graphql' ? 'graphql' : `graphql/${name}`;
}

function moduleItems(module, name) {
  return visibleChildren(module, {
    includeReferences: name !== 'graphql',
  }).filter(
    (item) =>
      name !== 'graphql' || sourceContext.rootExportNames.has(item.name),
  );
}

function categorizedItems(items) {
  const categories = [];
  const byCategory = new Map();
  const categoryByItem = new Map();
  const leftovers = [];

  for (const item of items) {
    if (isEnumLikeTypeAlias(item, items)) {
      continue;
    }
    const itemCategory = resolveItemCategory(item, items);
    categoryByItem.set(item, itemCategory);
    if (itemCategory != null && !byCategory.has(itemCategory)) {
      categories.push(itemCategory);
      byCategory.set(itemCategory, []);
    }
  }

  for (const item of items) {
    const itemCategory = categoryByItem.has(item)
      ? categoryByItem.get(item)
      : resolveItemCategory(item, items);
    const categoryItems = byCategory.get(itemCategory);
    if (categoryItems == null) {
      leftovers.push(item);
      continue;
    }
    categoryItems.push(item);
  }
  return { categories, byCategory, leftovers };
}

function moduleDocs(module) {
  const name = apiModuleName(module);
  const items = moduleItems(module, name);
  const { categories, byCategory, leftovers } = categorizedItems(items);
  return {
    module,
    name,
    title: moduleTitle(name),
    items,
    categories,
    byCategory,
    leftovers,
  };
}

function createReflectionIndex(doc) {
  const reflectionsById = new Map();
  collectReflection(reflectionsById, doc);
  return reflectionsById;
}

function collectReflection(reflectionsById, node) {
  if (node == null) {
    return;
  }
  if (typeof node.id === 'number') {
    reflectionsById.set(node.id, node);
  }
  for (const child of node.children ?? []) {
    collectReflection(reflectionsById, child);
  }
  for (const signature of node.signatures ?? []) {
    collectReflection(reflectionsById, signature);
  }
}

function createDocsIndex(modules) {
  const index = emptyDocsIndex();

  for (const docs of modules) {
    addSymbolDoc(index, docs.name, { page: docs.name });
    for (const child of docs.items) {
      const childDoc = { page: docs.name, anchor: slug(child.name) };
      const declaration = documentationNode(child);
      index.docsById.set(child.id, childDoc);
      addSymbolDoc(index, child.name, childDoc);
      index.typeParameterDefaultsById.set(
        child.id,
        (declaration.typeParameters ?? []).map(
          (param) => param.default ?? null,
        ),
      );
      if (isReflectionReference(child)) {
        continue;
      }
      for (const member of visibleChildren(child)) {
        const memberDoc = { page: docs.name, anchor: slug(member.name) };
        index.docsById.set(member.id, memberDoc);
        addSymbolDoc(index, `${child.name}.${member.name}`, memberDoc);
      }
      for (const signature of child.signatures ?? []) {
        index.docsById.set(signature.id, childDoc);
      }
    }
  }

  return index;
}

function addSymbolDoc(index, symbol, doc) {
  const docs = index.docsBySymbol.get(symbol);
  if (docs == null) {
    index.docsBySymbol.set(symbol, [doc]);
    return;
  }

  if (!docs.some((existing) => sameDoc(existing, doc))) {
    docs.push(doc);
  }
}

function sameDoc(left, right) {
  return left.page === right.page && left.anchor === right.anchor;
}

function renderGroup(title, items, level, allItems) {
  if (items.length === 0) {
    return [];
  }
  const lines = [heading(level, title)];
  for (const [index, item] of items.entries()) {
    if (index > 0) {
      lines.push('<hr className="api-item-divider" />');
    }
    lines.push(...renderDeclaration(item, level + 1, allItems));
  }
  return lines;
}

function grouped(items) {
  const map = new Map(groupOrder.map((name) => [name, []]));
  for (const item of items) {
    if (isEnumLikeTypeAlias(item, items)) {
      continue;
    }
    const kind = declarationKind(item, items);
    if (kind != null) {
      map.get(kind).push(item);
    }
  }
  return map;
}

function renderItems(items, page, level = 2) {
  const groups = grouped(items);
  const lines = [renderItemToc(groups, page)];
  for (const group of groupOrder) {
    lines.push(...renderGroup(group, groups.get(group), level, items));
  }
  return lines.filter(Boolean).join('\n\n').trimEnd() + '\n';
}

function renderItemToc(groups, page) {
  const lines = [];
  for (const group of groupOrder) {
    const groupItems = groups.get(group);
    if (groupItems.length === 0) {
      continue;
    }
    const tocItems = groupItems
      .map((item) => tocLink(item, page))
      .join('\n    <span aria-hidden="true">&middot;</span>\n    ');
    lines.push(
      `  <p>\n    <strong>${group}:</strong><br />\n    ${tocItems}\n  </p>`,
    );
  }
  return lines.length === 0
    ? ''
    : `<div className="api-category-toc">\n${lines.join('\n')}\n</div>`;
}

function tocLink(item, page) {
  const declaration = documentationNode(item);
  const label =
    declaration.kind === ReflectionKind.Function ? `${item.name}()` : item.name;
  const className =
    declaration.kind === ReflectionKind.Function &&
    isCallableDeprecated(item, declaration.signatures ?? [])
      ? ' className="api-deprecated-link"'
      : isDeprecated(item)
        ? ' className="api-deprecated-link"'
        : '';
  return `<a${className} href="${jsxAttribute(
    docHref({ page, anchor: slug(item.name) }),
  )}">${jsxText(label)}</a>`;
}

function subsection(title, lines) {
  return [
    '<hr className="api-subsection-divider" />',
    `<div className="api-subsection-title">${title}</div>`,
    ...lines,
  ];
}

function headingSubsection(title, level, lines = []) {
  return [
    '<hr className="api-subsection-divider" />',
    heading(level, title),
    ...lines,
  ];
}

function addApiCodeImport(page, content) {
  const imports = apiCodeComponents.filter((component) =>
    content.includes(`<${component}`),
  );
  if (imports.length === 0) {
    return content;
  }
  const importPath = page.includes('/')
    ? '../../../components/ApiCode'
    : '../../components/ApiCode';
  return `import { ${imports.join(', ')} } from '${importPath}';\n\n${content}`;
}

function writePage(page, content) {
  const path = join(generation.outputDir, `${page}.mdx`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stripTrailingWhitespace(addApiCodeImport(page, content)));
}

function stripTrailingWhitespace(value) {
  return value.replace(/[ \t]+$/gm, '');
}

function categoryLinks(visibleCategories, moduleName) {
  const links = visibleCategories
    .map((name) => `- [${name}](${categoryHref(moduleName, name)})`)
    .join('\n');
  return [
    'For documentation purposes, these exports are grouped into the following categories:',
    links,
  ].join('\n\n');
}

function categoryHref(moduleName, categoryName) {
  return `${renderContext.docsBasePath}/${moduleName}#${slug(
    categoryHeading(categoryName),
  )}`;
}

function categoryHeading(categoryName) {
  return `Category: ${categoryName}`;
}

function categorySection(name, items, moduleName) {
  return [
    heading(2, categoryHeading(name)),
    renderItems(items, moduleName, 3).trimEnd(),
  ].join('\n\n');
}

function renderModulePage(docs) {
  const content = [];
  if (isDeprecatedModule(docs)) {
    content.push(heading(1, deprecatedHeadingLabel(docs.title, true)));
  }
  content.push(summary(docs.module));
  if (docs.categories.length === 1) {
    content.push(
      renderItems(docs.byCategory.get(docs.categories[0]), docs.name).trimEnd(),
    );
  } else {
    content.push(categoryLinks(docs.categories, docs.name));
    content.push(
      ...docs.categories.map((name) =>
        categorySection(name, docs.byCategory.get(name), docs.name),
      ),
    );
  }
  return content.filter(Boolean).join('\n\n') + '\n';
}

function isDeprecatedModule(docs) {
  return (
    isDeprecated(docs.module) ||
    (docs.name === 'subscription' &&
      /\bdeprecated\b/i.test(summary(docs.module)))
  );
}

function addModuleMeta(meta, docs) {
  const entry = [docs.name, docs.title];
  if (docs.name === 'graphql') {
    meta.unshift(entry);
  } else {
    meta.push(entry);
  }
}

function assertAllItemsCategorized(docs) {
  if (docs.leftovers.length === 0) {
    return;
  }

  fail(
    `Missing @category in ${docs.title}: ` +
      docs.leftovers.map((item) => item.name).join(', '),
  );
}

function writeCategoryMeta(docs) {
  if (docs.categories.length <= 1) {
    return;
  }

  const dir = join(generation.outputDir, docs.name);
  mkdirSync(dir, { recursive: true });
  writeMeta(
    dir,
    docs.categories.map((name) => [
      slug(name),
      { title: categoryHeading(name), href: categoryHref(docs.name, name) },
    ]),
  );
}

function buildApiReference(doc) {
  const reflectionsById = createReflectionIndex(doc);
  renderContext.reflectionsById = reflectionsById;
  const modules = (doc.children ?? []).map(moduleDocs);
  return {
    index: createDocsIndex(modules),
    modules,
    reflectionsById,
  };
}

function writeApiReference(reference) {
  renderContext.docsBasePath = generation.docsBasePath;
  renderContext.docsIndex = reference.index;
  renderContext.reflectionsById = reference.reflectionsById;

  rmSync(generation.outputDir, { recursive: true, force: true });
  mkdirSync(generation.outputDir, { recursive: true });

  const meta = [];
  for (const docs of reference.modules) {
    addModuleMeta(meta, docs);
    assertAllItemsCategorized(docs);
    writePage(docs.name, renderModulePage(docs));
    writeCategoryMeta(docs);
  }

  writeMeta(generation.outputDir, meta);
}

function renderDocs(doc) {
  writeApiReference(buildApiReference(doc));
}

function addCategory(comment, category) {
  if (/@category\b/.test(comment)) {
    return comment;
  }

  const trailing = comment.match(/\s*$/)?.[0] ?? '';
  const body = comment.slice(0, comment.length - trailing.length);
  const oneLine = /^(\s*)\/\*\*\s*(.*?)\s*\*\/$/.exec(body);
  if (oneLine != null) {
    const [, indent, text] = oneLine;
    return `${indent}/**\n${indent} * ${text}\n${indent} *\n${indent} * @category ${category}\n${indent} */${trailing}`;
  }
  return (
    body.replace(/\n\s*\*\/$/, `\n *\n * @category ${category}\n */`) + trailing
  );
}

function leadingJSDocRange(content, node) {
  const index = node.getStart();
  const before = content.slice(0, index);
  const start = before.lastIndexOf('/**');
  const end = start === -1 ? -1 : before.indexOf('*/', start);
  const jsdocEnd = end === -1 ? -1 : end + 2;

  if (
    start === -1 ||
    jsdocEnd < start ||
    !isLeadingLineCommentTrivia(before.slice(jsdocEnd))
  ) {
    return null;
  }
  return { start, end: jsdocEnd };
}

function isLeadingLineCommentTrivia(value) {
  return value.replace(/\/\/[^\n\r]*(?:\r?\n|$)/g, '').trim() === '';
}

function isExported(node) {
  return node.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );
}

function localExportNames(ast) {
  const names = new Set();
  for (const statement of ast.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier == null &&
      statement.exportClause != null &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        names.add((element.propertyName ?? element.name).text);
      }
    }
  }
  return names;
}

function declarationNames(statement) {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations
      .map((declaration) =>
        ts.isIdentifier(declaration.name) ? declaration.name.text : null,
      )
      .filter(Boolean);
  }
  return statement.name?.text == null ? [] : [statement.name.text];
}

function exportedDeclarations(ast) {
  const localExports = localExportNames(ast);
  return ast.statements.filter(
    (statement) =>
      (ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isVariableStatement(statement)) &&
      (isExported(statement) ||
        declarationNames(statement).some((name) => localExports.has(name))),
  );
}

function inheritFileCategories(dir) {
  // A file-level @category is a default for exported declarations in the
  // generated snapshot only; the checked-out source tree is not changed.
  walkFiles(dir, (path) => {
    if (!path.endsWith('.ts')) {
      return;
    }

    let content = readFileSync(path, 'utf8');
    const category = content
      .match(/^\/\*\*([\s\S]*?)\*\//)?.[1]
      .match(/@category\s+([^\n*]+)/)?.[1]
      .trim();
    if (category == null) {
      return;
    }

    const declarations = exportedDeclarations(sourceFile(path, content));

    for (let i = declarations.length - 1; i >= 0; i--) {
      const index = declarations[i].getStart();
      const before = content.slice(0, index);
      const start = before.lastIndexOf('/**');
      const end = start === -1 ? -1 : before.indexOf('*/', start);
      const jsdocEnd = end === -1 ? -1 : end + 2;

      if (
        start === -1 ||
        jsdocEnd < start ||
        !isLeadingLineCommentTrivia(before.slice(jsdocEnd))
      ) {
        content =
          content.slice(0, index) +
          `/**\n * @category ${category}\n */\n` +
          content.slice(index);
      } else {
        content =
          content.slice(0, start) +
          addCategory(before.slice(start, jsdocEnd), category) +
          before.slice(jsdocEnd) +
          content.slice(index);
      }
    }

    writeFileSync(path, content);
  });
}

function exposePublicOverloadSignatures(dir) {
  // TypeDoc applies @internal on an overload implementation to the whole
  // function reflection. Keep public overload signatures visible, but remove
  // the implementation's own JSDoc from the generated snapshot.
  walkFiles(dir, (path) => {
    if (!path.endsWith('.ts')) {
      return;
    }

    let content = readFileSync(path, 'utf8');
    const ranges = publicOverloadImplementationJSDocRanges(
      sourceFile(path, content),
      content,
    );
    for (let i = ranges.length - 1; i >= 0; i--) {
      const range = ranges[i];
      content =
        content.slice(0, range.start) +
        content.slice(range.end).replace(/^\r?\n/, '');
    }

    if (ranges.length > 0) {
      writeFileSync(path, content);
    }
  });
}

function publicOverloadImplementationJSDocRanges(ast, content) {
  const localExports = localExportNames(ast);
  const declarationsByName = new Map();

  for (const statement of ast.statements) {
    if (
      !ts.isFunctionDeclaration(statement) ||
      statement.name == null ||
      (!isExported(statement) && !localExports.has(statement.name.text))
    ) {
      continue;
    }

    const declarations = declarationsByName.get(statement.name.text) ?? [];
    declarations.push(statement);
    declarationsByName.set(statement.name.text, declarations);
  }

  const ranges = [];
  for (const declarations of declarationsByName.values()) {
    const hasPublicOverload = declarations.some(
      (declaration) =>
        declaration.body == null &&
        !hasJSDocTag(declaration, 'internal') &&
        !hasJSDocTag(declaration, 'private'),
    );
    if (!hasPublicOverload) {
      continue;
    }

    for (const declaration of declarations) {
      if (declaration.body == null || !hasJSDocTag(declaration, 'internal')) {
        continue;
      }

      const range = leadingJSDocRange(content, declaration);
      if (range != null) {
        ranges.push(range);
      }
    }
  }

  return ranges;
}

function prepareSourceSnapshot() {
  // Snapshot the source before running TypeDoc so generation-only compatibility
  // fixes never mutate the working tree.
  copySourceSnapshot(generation.sourceDir, generation.tmpSourceDir);
  writeSnapshotTsConfig(generation.sourceDir, generation.tmpSourceDir);
  copyOptionalTsdoc(generation.sourceDir, generation.tmpSourceDir);
  writeTypedocOptions();
}

function copySourceSnapshot(sourceDir, tmpSourceDir) {
  mkdirSync(tmpSourceDir, { recursive: true });
  cpSync(join(sourceDir, 'src'), join(tmpSourceDir, 'src'), {
    recursive: true,
  });
  stripCoverageIgnoreComments(join(tmpSourceDir, 'src'));
  inheritFileCategories(join(tmpSourceDir, 'src'));
  exposePublicOverloadSignatures(join(tmpSourceDir, 'src'));
}

function stripCoverageIgnoreComments(dir) {
  // Coverage hints can sit between public JSDoc and a declaration. They are
  // irrelevant to the generated snapshot and can prevent TypeDoc from attaching
  // the public docs to the declaration.
  walkFiles(dir, (path) => {
    if (!path.endsWith('.ts')) {
      return;
    }

    const content = readFileSync(path, 'utf8');
    const nextContent = content.replace(
      /^[ \t]*\/\*\s*c8 ignore [^*]*\*\/\r?\n/gm,
      '',
    );
    if (nextContent !== content) {
      writeFileSync(path, nextContent);
    }
  });
}

function writeSnapshotTsConfig(sourceDir, tmpSourceDir) {
  const tsconfig = sanitizeTsConfig(
    readTsConfig(join(sourceDir, 'tsconfig.json')),
  );
  writeJson(join(tmpSourceDir, 'tsconfig.json'), tsconfig);
}

function copyOptionalTsdoc(sourceDir, tmpSourceDir) {
  const tsdocPath = join(sourceDir, 'tsdoc.json');
  if (existsSync(tsdocPath)) {
    cpSync(tsdocPath, join(tmpSourceDir, 'tsdoc.json'));
  }
}

function writeTypedocOptions() {
  const typedocOptions = readJson(typedocTemplatePath);
  typedocOptions.name = `GraphQL.js v${generation.docsVersionLabel.slice(
    5,
  )} API`;
  typedocOptions.entryPoints = typedocEntryPoints(generation.tmpSourceDir);
  typedocOptions.json = generation.jsonPath;
  typedocOptions.tsconfig = join(generation.tmpSourceDir, 'tsconfig.json');
  typedocOptions.disableSources = false;
  writeJson(generation.typedocOptionsPath, typedocOptions);
}

function typedocEntryPoints(sourceRootDir) {
  return [
    'src/error/index.ts',
    'src/execution/index.ts',
    'src/language/index.ts',
    'src/subscription/index.ts',
    'src/type/index.ts',
    'src/utilities/index.ts',
    'src/validation/index.ts',
    'src/index.ts',
  ]
    .map((path) => join(sourceRootDir, path))
    .filter((path) => existsSync(path));
}

function rememberGeneratedMajor(generatedMajors, majorVersion) {
  if (generatedMajors.has(majorVersion)) {
    fail(
      `Multiple refs resolve to v${majorVersion}; refusing to overwrite docs.`,
    );
  }
  generatedMajors.add(majorVersion);
}

function runTypedoc(ref) {
  console.log(
    `[${generation.docsVersionLabel}] Copied source snapshot from:`,
    ref,
  );
  run(
    'npm',
    ['exec', '--', 'typedoc', '--options', generation.typedocOptionsPath],
    websiteDir,
  );
}

function readTypedocOutput() {
  if (!existsSync(generation.jsonPath)) {
    fail('TypeDoc did not emit JSON docs.');
  }

  return readJson(generation.jsonPath);
}

function generateForRef(ref, index, generatedMajors) {
  const sourceCheckoutDir = checkoutSourceRef(ref, index);
  const majorVersion = configureGeneration(ref, sourceCheckoutDir);
  rememberGeneratedMajor(generatedMajors, majorVersion);
  prepareSourceSnapshot();
  sourceContext = analyzeSourceSnapshot(generation.tmpSourceDir);
  runTypedoc(ref);
  renderDocs(readTypedocOutput());
}

function generateRefs(refs) {
  if (refs.length === 0) {
    fail('Usage: npm run generate:docs <branch-or-ref> [...branch-or-ref]');
  }

  const generatedMajors = new Set();
  for (const [index, ref] of refs.entries()) {
    generateForRef(ref, index, generatedMajors);
  }
}

try {
  generateRefs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  removeSourceWorktrees();
  if (process.env.GRAPHQL_JS_API_KEEP_TMP === '1') {
    console.error('[api-docs] Kept temporary directory:', tmpDir);
  } else {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
