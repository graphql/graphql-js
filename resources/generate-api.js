'use strict';

/* eslint-disable arrow-body-style, no-loop-func, no-shadow */

const {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');

const repoRoot = resolve(__dirname, '..');
const websiteDir = join(repoRoot, 'website');
const apiDocsDir = join(__dirname, 'api-docs');
const apiDocsRequire = createRequire(join(apiDocsDir, 'package.json'));
const typedocTemplatePath = join(__dirname, 'typedoc-api.json');
const tmpDir = mkdtempSync(join(tmpdir(), 'graphql-js-api-'));
const ts = apiDocsRequire('typescript');

let sourceDir;
let tmpSourceDir;
let jsonPath;
let typedocOptionsPath;
let outputDir;
let docsBasePath;
let docsVersionLabel = 'api-docs';
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
  Parameter: 32768,
  TypeAlias: 2097152,
  Reference: 4194304,
};

let docsById = new Map();
let docsBySymbol = new Map();
let typeParameterDefaultsById = new Map();
let rootExportNames = new Set();
let sourceMetadata = emptySourceMetadata();

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
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
    if (result.status !== 0) {
      console.error(`[api-docs] Failed to remove temporary worktree: ${dir}`);
    }
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
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
  throw new Error(`[${docsVersionLabel}] ${message}`);
}

function sourceFile(path, content) {
  return ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
}

function assertSourceRoot() {
  if (!existsSync(join(sourceDir, 'src/index.ts'))) {
    fail(`Source directory does not look like graphql-js root: ${sourceDir}`);
  }
}

function sourceMajorVersion() {
  const version = readJson(join(sourceDir, 'package.json')).version;
  const match = typeof version === 'string' ? /^(\d+)\./.exec(version) : null;
  if (match == null) {
    fail(`Cannot infer major version from package version: ${version}`);
  }
  return Number(match[1]);
}

function configureGeneration(ref, dir) {
  docsVersionLabel = ref;
  sourceDir = dir;
  assertSourceRoot();

  const majorVersion = sourceMajorVersion();
  const apiVersion = `api-v${majorVersion}`;
  docsVersionLabel = apiVersion;
  tmpSourceDir = join(tmpDir, `${apiVersion}-source`);
  jsonPath = join(tmpDir, `${apiVersion}.json`);
  typedocOptionsPath = join(tmpDir, `${apiVersion}-typedoc.json`);
  outputDir = join(websiteDir, `pages/${apiVersion}`);
  docsBasePath = `/${apiVersion}`;
  return majorVersion;
}

function walkFiles(dir, fn) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(path, fn);
    } else if (entry.isFile()) {
      fn(path);
    }
  }
}

function collectRootExportNames() {
  // The root package page documents only declarations exported from files
  // directly under src/. Submodule re-exports are documented on submodule pages.
  const path = join(tmpSourceDir, 'src/index.ts');
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

function collectSourceMetadata(dir) {
  const metadata = emptySourceMetadata();
  walkFiles(dir, (path) => {
    if (!path.endsWith('.ts')) {
      return;
    }

    const ast = sourceFile(path, readFileSync(path, 'utf8'));
    const packagePath = path.slice(tmpSourceDir.length + 1);

    for (const statement of ast.statements) {
      collectTypeDefinition(metadata, statement, packagePath);
      collectImportedTypes(metadata, path, statement, packagePath);
      collectDeclarationDefaults(metadata, statement, packagePath);
    }
  });

  return metadata;
}

function collectTypeDefinition(metadata, statement, packagePath) {
  if (
    (ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)) &&
    statement.name != null
  ) {
    metadata.typesByRef.set(sourceTypeKey(packagePath, statement.name.text), {
      isPublic: hasJSDocTag(statement, 'public'),
      packagePath,
      node: statement,
    });
  }
}

function collectImportedTypes(metadata, path, statement, packagePath) {
  if (!ts.isImportDeclaration(statement)) {
    return;
  }

  const targetPackagePath = importPackagePath(path, statement);
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

function importPackagePath(path, statement) {
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
  return targetPath == null ? null : targetPath.slice(tmpSourceDir.length + 1);
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
  return ts.getJSDocTags(node).some((tag) => tag.tagName.text === tagName);
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
  const lines = entries.map(([key, label]) => `  ${metaKey(key)}: '${label}',`);
  writeFileSync(
    join(dir, '_meta.ts'),
    `const meta = {\n${lines.join('\n')}\n};\n\nexport default meta;\n`,
  );
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

function tag(comment, name) {
  return comment?.blockTags?.find((block) => block.tag === name);
}

function tagText(comment, name, options) {
  const block = tag(comment, name);
  return block == null ? '' : renderParts(block.content, options).trim();
}

function defaultText(node, parent, options = {}) {
  const sourceDefault = sourceDefaultValue(node, parent, options);
  if (sourceDefault != null) {
    return code(sourceDefault);
  }
  return node.defaultValue == null || node.defaultValue === '...'
    ? ''
    : code(node.defaultValue);
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
    sourceMetadata.defaultValuesByRef.get(
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
  return (
    tagText(node.comment, '@category') ||
    tagText(node.signatures?.[0]?.comment, '@category') ||
    null
  );
}

function category(node, siblings = []) {
  const ownCategory = directCategory(node);
  if (ownCategory != null && ownCategory !== '') {
    return ownCategory;
  }

  if (isEnumNamespace(node)) {
    return commonCategory(enumLikeMembers(node).map(directCategory));
  }

  const matchingSibling = siblings.find(
    (sibling) =>
      sibling !== node &&
      sibling.name === node.name &&
      directCategory(sibling) != null,
  );
  return matchingSibling == null ? null : directCategory(matchingSibling);
}

function commonCategory(categories) {
  const visibleCategories = categories.filter(Boolean);
  if (visibleCategories.length === 0) {
    return null;
  }
  const [first] = visibleCategories;
  return visibleCategories.every((item) => item === first) ? first : null;
}

function categoriesForItems(items) {
  const categories = [];
  const seen = new Set();
  for (const item of items) {
    if (isEnumLikeTypeAlias(item, items)) {
      continue;
    }
    const itemCategory = category(item, items);
    if (itemCategory != null && !seen.has(itemCategory)) {
      seen.add(itemCategory);
      categories.push(itemCategory);
    }
  }
  return categories;
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
      if (part.kind === 'inline-tag' && part.tag === '@link') {
        const label = part.text || part.target || '';
        return typeof part.target === 'number'
          ? link(label, part.target)
          : code(label);
      }
      return part.text ?? '';
    })
    .join('');
}

function linkCodeSpan(value) {
  const symbol = inlineCodeText(value);
  const docs = symbol == null ? null : docsBySymbol.get(symbol);
  if (docs == null || docs.length !== 1) {
    return value;
  }

  const doc = docs[0];
  const href = `${docsBasePath}/${doc.page}${
    doc.anchor == null ? '' : `#${doc.anchor}`
  }`;
  return `[${code(symbol)}](${href})`;
}

function inlineCodeText(value) {
  const text = String(value);
  return text.startsWith('`') && text.endsWith('`') && !text.includes('\n')
    ? text.slice(1, -1)
    : null;
}

function link(label, target) {
  const doc = docsById.get(target);
  if (doc == null) {
    return code(label);
  }
  const href = `${docsBasePath}/${doc.page}#${doc.anchor}`;
  return `[${label}](${href})`;
}

function typeLink(label, target) {
  const doc = docsById.get(target);
  if (doc == null) {
    return code(label);
  }
  return `[${code(label)}](${docsBasePath}/${doc.page}#${doc.anchor})`;
}

function heading(level, text) {
  return `${'#'.repeat(level)} ${text}`;
}

function code(value) {
  const text = String(value).replace(/\r?\n|\r/g, ' ');
  const longestBacktickRun = Math.max(
    0,
    ...Array.from(text.matchAll(/`+/g), (match) => match[0].length),
  );
  // Markdown code spans cannot escape backticks with backslashes.
  const delimiter = '`'.repeat(longestBacktickRun + 1);
  const padding = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${delimiter}${padding}${text}${padding}${delimiter}`;
}

function text(value) {
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
  return text(value).replace(/"/g, '&quot;');
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
  return mapInlineCodeSpans(String(value), mdxText, (rawCode, delimiter) => {
    return `${delimiter}${rawCode}${delimiter}`;
  });
}

function table(rows) {
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((cell) => text(cell));
  const separator = headers.map(() => '---');
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.slice(1).map((row) => `| ${row.map(tableCell).join(' | ')} |`),
  ];
  return [lines.join('\n')];
}

function tableCell(value) {
  if (String(value).includes('<ApiType>')) {
    return String(value).replace(/\n+/g, '<br />').replace(/\|/g, '&#124;');
  }
  return mapInlineCodeSpans(String(value), tableText, tableCode);
}

function tableText(value) {
  return mdxText(value)
    .replace(/\\/g, '&#92;')
    .replace(/\n+/g, '<br />')
    .replace(/\|/g, '&#124;');
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

function tableCode(rawCode, delimiter) {
  const value = normalizeCodeSpan(rawCode);
  if (/[\\|]/.test(value)) {
    return jsxCode(value);
  }
  return `${delimiter}${value}${delimiter}`;
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

function rawTypeName(type) {
  return typeName(type, { keepDefaultTypeArguments: true });
}

function typeArguments(type, options) {
  const args = type.typeArguments ?? [];
  const target = targetId(type);
  const defaults =
    target == null ? null : typeParameterDefaultsById.get(target);
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
      const typeArgs = args.length
        ? `<${args.map((arg) => typeName(arg, options)).join(', ')}>`
        : '';
      return `${type.name ?? type.qualifiedName}${typeArgs}`;
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

function renderType(type, options = {}) {
  if (type == null) {
    return code('unknown');
  }

  switch (type.type) {
    case 'array':
      return `${renderArrayElementType(type.elementType, options)}[]`;
    case 'conditional':
      return `${renderType(type.checkType, options)} extends ${renderType(
        type.extendsType,
        options,
      )} ? ${renderType(type.trueType, options)} : ${renderType(
        type.falseType,
        options,
      )}`;
    case 'indexedAccess':
      return `${renderType(type.objectType, options)}[${renderType(
        type.indexType,
        options,
      )}]`;
    case 'inferred':
    case 'intrinsic':
      return code(type.name);
    case 'intersection':
      return type.types.map((item) => renderType(item, options)).join(' & ');
    case 'literal':
      return code(JSON.stringify(type.value));
    case 'mapped':
      return code('mapped object');
    case 'optional':
      return `${renderType(type.elementType, options)}?`;
    case 'predicate':
      return code(typeName(type, options));
    case 'query':
      return `typeof ${renderType(type.queryType, options)}`;
    case 'reference': {
      const expanded = sourceTypeEquivalent(type, {
        ...options,
        renderMarkdown: true,
      });
      if (expanded != null) {
        return expanded;
      }
      const name = type.name ?? type.qualifiedName;
      const target = targetId(type);
      const base =
        target != null && docsById.has(target)
          ? typeLink(name, target)
          : code(name);
      const args = typeArguments(type, options);
      const typeArgs = args.length
        ? `&lt;${args.map((arg) => renderType(arg, options)).join(', ')}&gt;`
        : '';
      return `${base}${typeArgs}`;
    }
    case 'reflection':
      return renderReflectionType(type.declaration, options);
    case 'rest':
      return `...${renderType(type.elementType, options)}`;
    case 'templateLiteral':
      return code('template literal');
    case 'tuple':
      return `[${type.elements
        .map((item) => renderType(item, options))
        .join(', ')}]`;
    case 'typeOperator':
      if (type.operator === 'readonly' && type.target?.type === 'array') {
        return `readonly ${renderArrayElementType(
          type.target.elementType,
          options,
        )}[]`;
      }
      return `${code(type.operator)} ${renderType(type.target, options)}`;
    case 'union':
      return type.types.map((item) => renderType(item, options)).join(' | ');
    case 'unknown':
      return code('unknown');
  }
  return code(type.name ?? type.type ?? 'unknown');
}

function sourceTypeEquivalent(type, options = {}) {
  const qualifiedName = type.target?.qualifiedName ?? type.qualifiedName;
  if (qualifiedName == null) {
    return null;
  }

  const renderedTypeArguments = (type.typeArguments ?? []).map((arg) =>
    options.renderJSX
      ? renderSignatureTypeName(arg, options)
      : options.renderMarkdown
      ? renderType(arg, options)
      : typeName(arg, options),
  );
  if (options.sourcePackagePath == null) {
    return null;
  }
  return sourceTypeName(
    options.sourcePackagePath,
    qualifiedName,
    options,
    renderedTypeArguments,
  );
}

function sourceTypeName(
  packagePath,
  qualifiedName,
  options = {},
  typeArguments = [],
) {
  if (
    options.typeSubstitutions?.has(qualifiedName) &&
    typeArguments.length === 0
  ) {
    return options.typeSubstitutions.get(qualifiedName);
  }

  const key = sourceTypeKey(packagePath, qualifiedName);
  const seen = options.seenSourceTypes ?? new Set();
  if (seen.has(key)) {
    return null;
  }

  const importedType = sourceMetadata.importsByRef.get(key);
  if (importedType != null) {
    return sourceTypeName(
      importedType.packagePath,
      importedType.qualifiedName,
      {
        ...options,
        seenSourceTypes: new Set([...seen, key]),
      },
      typeArguments,
    );
  }

  const definition = sourceMetadata.typesByRef.get(key);
  if (definition == null || definition.isPublic) {
    return null;
  }

  const typeSubstitutions = new Map(options.typeSubstitutions);
  for (const [index, parameter] of (
    definition.node.typeParameters ?? []
  ).entries()) {
    const typeArgument = typeArguments[index];
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
    return nextOptions.renderJSX
      ? renderTypeNodeJSX(node.type, definition.packagePath, nextOptions)
      : nextOptions.renderMarkdown
      ? renderTypeNode(node.type, definition.packagePath, nextOptions)
      : typeNodeName(node.type, definition.packagePath, nextOptions);
  }
  return null;
}

function interfaceTypeName(node, packagePath, options) {
  const members = node.members
    .map((member) => interfaceMemberTypeName(member, packagePath, options))
    .filter(Boolean);

  if (options.renderJSX) {
    return members.length === 0
      ? signatureTypeToken('object')
      : `${signatureText('{ ')}${members.join(
          signatureText('; '),
        )}${signatureText(' }')}`;
  }
  return members.length === 0 ? 'object' : `{ ${members.join('; ')} }`;
}

function interfaceMemberTypeName(member, packagePath, options) {
  if (!ts.isPropertySignature(member) || member.type == null) {
    return null;
  }
  const name = propertyNameText(member.name);
  if (name == null) {
    return null;
  }
  if (options.renderJSX) {
    return `${signatureText(name)}${
      member.questionToken == null ? '' : signatureText('?')
    }${signatureText(': ')}${renderTypeNodeJSX(
      member.type,
      packagePath,
      options,
    )}`;
  }
  return `${name}${member.questionToken == null ? '' : '?'}: ${
    options.renderMarkdown
      ? renderTypeNode(member.type, packagePath, options)
      : typeNodeName(member.type, packagePath, options)
  }`;
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
    const typeArgs =
      node.typeArguments == null || node.typeArguments.length === 0
        ? []
        : node.typeArguments.map((arg) =>
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

function renderTypeNode(node, packagePath, options) {
  if (ts.isArrayTypeNode(node)) {
    const element = renderTypeNode(node.elementType, packagePath, options);
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
              ? code('unknown')
              : renderTypeNode(param.type, packagePath, options)
          }`,
      )
      .join(', ');
    return `(${params}) => ${renderTypeNode(node.type, packagePath, options)}`;
  }
  if (ts.isLiteralTypeNode(node)) {
    return code(node.literal.getText());
  }
  if (ts.isParenthesizedTypeNode(node)) {
    return `(${renderTypeNode(node.type, packagePath, options)})`;
  }
  if (ts.isTypeLiteralNode(node)) {
    return interfaceTypeName(node, packagePath, options);
  }
  if (ts.isTypeOperatorNode(node)) {
    return `${code(
      node.operator === ts.SyntaxKind.ReadonlyKeyword
        ? 'readonly'
        : node.operator,
    )} ${renderTypeNode(node.type, packagePath, options)}`;
  }
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText();
    const typeArgs =
      node.typeArguments == null || node.typeArguments.length === 0
        ? []
        : node.typeArguments.map((arg) =>
            renderTypeNode(arg, packagePath, options),
          );
    const expanded = sourceTypeName(packagePath, name, options, typeArgs);
    const typeArgsText =
      typeArgs.length === 0 ? '' : `&lt;${typeArgs.join(', ')}&gt;`;
    return expanded ?? `${renderSourceTypeName(name)}${typeArgsText}`;
  }
  if (ts.isTupleTypeNode(node)) {
    return `[${node.elements
      .map((element) => renderTypeNode(element, packagePath, options))
      .join(', ')}]`;
  }
  if (ts.isUnionTypeNode(node)) {
    return node.types
      .map((item) => renderTypeNode(item, packagePath, options))
      .join(' | ');
  }
  if (ts.isIntersectionTypeNode(node)) {
    return node.types
      .map((item) => renderTypeNode(item, packagePath, options))
      .join(' & ');
  }

  return code(node.getText());
}

function renderTypeNodeJSX(node, packagePath, options) {
  const keyword = typeNodeKeyword(node);
  if (keyword != null) {
    return signatureKeyword(keyword);
  }
  if (ts.isArrayTypeNode(node)) {
    const element = renderTypeNodeJSX(node.elementType, packagePath, options);
    return ts.isUnionTypeNode(node.elementType) ||
      ts.isIntersectionTypeNode(node.elementType)
      ? `${signatureText('(')}${element}${signatureText(')[]')}`
      : `${element}${signatureText('[]')}`;
  }
  if (ts.isFunctionTypeNode(node)) {
    const params = node.parameters
      .map(
        (param) =>
          `${signatureText(param.name.getText())}${
            param.questionToken == null ? '' : signatureText('?')
          }${signatureText(': ')}${
            param.type == null
              ? signatureTypeToken('unknown')
              : renderTypeNodeJSX(param.type, packagePath, options)
          }`,
      )
      .join(signatureText(', '));
    return `${signatureText('(')}${params}${signatureText(
      ') => ',
    )}${renderTypeNodeJSX(node.type, packagePath, options)}`;
  }
  if (ts.isLiteralTypeNode(node)) {
    return signatureText(node.literal.getText());
  }
  if (ts.isParenthesizedTypeNode(node)) {
    return `${signatureText('(')}${renderTypeNodeJSX(
      node.type,
      packagePath,
      options,
    )}${signatureText(')')}`;
  }
  if (ts.isTypeLiteralNode(node)) {
    return interfaceTypeName(node, packagePath, options);
  }
  if (ts.isTypeOperatorNode(node)) {
    return `${signatureKeyword(
      node.operator === ts.SyntaxKind.ReadonlyKeyword
        ? 'readonly'
        : node.operator,
    )} ${renderTypeNodeJSX(node.type, packagePath, options)}`;
  }
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText();
    const typeArgs =
      node.typeArguments == null || node.typeArguments.length === 0
        ? []
        : node.typeArguments.map((arg) =>
            renderTypeNodeJSX(arg, packagePath, options),
          );
    const expanded = sourceTypeName(packagePath, name, options, typeArgs);
    const typeArgsText =
      typeArgs.length === 0
        ? ''
        : `${signatureText('<')}${typeArgs.join(
            signatureText(', '),
          )}${signatureText('>')}`;
    return expanded ?? `${renderSourceTypeNameJSX(name)}${typeArgsText}`;
  }
  if (ts.isTupleTypeNode(node)) {
    return `${signatureText('[')}${node.elements
      .map((element) => renderTypeNodeJSX(element, packagePath, options))
      .join(signatureText(', '))}${signatureText(']')}`;
  }
  if (ts.isUnionTypeNode(node)) {
    return node.types
      .map((item) => renderTypeNodeJSX(item, packagePath, options))
      .join(signatureText(' | '));
  }
  if (ts.isIntersectionTypeNode(node)) {
    return node.types
      .map((item) => renderTypeNodeJSX(item, packagePath, options))
      .join(signatureText(' & '));
  }

  return signatureText(node.getText());
}

function typeNodeKeyword(node) {
  switch (node.kind) {
    case ts.SyntaxKind.AnyKeyword:
      return 'any';
    case ts.SyntaxKind.BigIntKeyword:
      return 'bigint';
    case ts.SyntaxKind.BooleanKeyword:
      return 'boolean';
    case ts.SyntaxKind.NeverKeyword:
      return 'never';
    case ts.SyntaxKind.NullKeyword:
      return 'null';
    case ts.SyntaxKind.NumberKeyword:
      return 'number';
    case ts.SyntaxKind.ObjectKeyword:
      return 'object';
    case ts.SyntaxKind.StringKeyword:
      return 'string';
    case ts.SyntaxKind.SymbolKeyword:
      return 'symbol';
    case ts.SyntaxKind.UndefinedKeyword:
      return 'undefined';
    case ts.SyntaxKind.UnknownKeyword:
      return 'unknown';
    case ts.SyntaxKind.VoidKeyword:
      return 'void';
  }
  return null;
}

function renderSourceTypeName(name) {
  const docs = docsBySymbol.get(name);
  if (docs == null || docs.length !== 1) {
    return code(name);
  }

  const doc = docs[0];
  const href = `${docsBasePath}/${doc.page}${
    doc.anchor == null ? '' : `#${doc.anchor}`
  }`;
  return `[${code(name)}](${href})`;
}

function renderSourceTypeNameJSX(name) {
  const docs = docsBySymbol.get(name);
  if (docs == null || docs.length !== 1) {
    return signatureTypeToken(name);
  }

  const doc = docs[0];
  return signatureLink(
    name,
    `${docsBasePath}/${doc.page}${doc.anchor == null ? '' : `#${doc.anchor}`}`,
  );
}

function signatureText(value) {
  return jsxText(value);
}

function signatureToken(value, kind) {
  return `<span className="api-signature-${kind}">${jsxText(value)}</span>`;
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

function signatureLink(label, href) {
  return `<a href="${jsxAttribute(href)}">${jsxText(label)}</a>`;
}

function signatureTypeLink(label, target) {
  const doc = docsById.get(target);
  if (doc == null) {
    return signatureTypeToken(label);
  }
  return signatureLink(label, `${docsBasePath}/${doc.page}#${doc.anchor}`);
}

function arrayElementTypeName(type, options = {}) {
  const name = typeName(type, options);
  return type?.type === 'union' || type?.type === 'intersection'
    ? `(${name})`
    : name;
}

function renderArrayElementType(type, options = {}) {
  return type?.type === 'union' || type?.type === 'intersection'
    ? `(${renderType(type, options)})`
    : renderType(type, options);
}

function renderSignatureArrayElementType(type, options = {}) {
  return type?.type === 'union' || type?.type === 'intersection'
    ? `${signatureText('(')}${renderSignatureTypeName(
        type,
        options,
      )}${signatureText(')')}`
    : renderSignatureTypeName(type, options);
}

function reflectionType(node, options = {}) {
  if (node?.signatures?.length) {
    return node.signatures
      .map((signature) => signatureType(signature, options))
      .join(' | ');
  }
  if (node?.children?.length) {
    return `{ ${node.children
      .map(
        (child) =>
          `${child.name}${child.flags?.isOptional ? '?' : ''}: ${typeName(
            child.type,
            options,
          )}`,
      )
      .join('; ')} }`;
  }
  return 'object';
}

function renderReflectionType(node, options = {}) {
  if (node?.signatures?.length) {
    return node.signatures
      .map((signature) => renderSignatureType(signature, options))
      .join(' | ');
  }
  if (node?.children?.length) {
    return `&#123; ${node.children
      .map(
        (child) =>
          `${text(child.name)}${
            child.flags?.isOptional ? '?' : ''
          }: ${renderType(child.type, options)}`,
      )
      .join('; ')} &#125;`;
  }
  return 'object';
}

function signatureType(signature, options = {}) {
  return `${parameterList(signature, options)}: ${typeName(
    signature.type,
    options,
  )}`;
}

function renderSignatureType(signature, options = {}) {
  return `${renderParameterList(signature, options)}: ${renderType(
    signature.type,
    options,
  )}`;
}

function renderSignatureReflectionType(node, options = {}) {
  if (node?.signatures?.length) {
    return node.signatures
      .map((signature) => renderSignatureTypeJSX(signature, options))
      .join(signatureText(' | '));
  }
  if (node?.children?.length) {
    return `${signatureText('{ ')}${node.children
      .map(
        (child) =>
          `${signatureText(child.name)}${
            child.flags?.isOptional ? signatureText('?') : ''
          }${signatureText(': ')}${renderSignatureTypeName(
            child.type,
            options,
          )}`,
      )
      .join(signatureText('; '))}${signatureText(' }')}`;
  }
  return signatureTypeToken('object');
}

function renderSignatureTypeJSX(signature, options = {}) {
  return `${parameterListJSX(signature, options)}${signatureText(
    ': ',
  )}${renderSignatureTypeName(signature.type, options)}`;
}

function renderSignatureTypeName(type, options = {}) {
  if (type == null) {
    return signatureTypeToken('unknown');
  }

  switch (type.type) {
    case 'array':
      return `${renderSignatureArrayElementType(
        type.elementType,
        options,
      )}${signatureText('[]')}`;
    case 'conditional':
      return `${renderSignatureTypeName(
        type.checkType,
        options,
      )}${signatureText(' extends ')}${renderSignatureTypeName(
        type.extendsType,
        options,
      )}${signatureText(' ? ')}${renderSignatureTypeName(
        type.trueType,
        options,
      )}${signatureText(' : ')}${renderSignatureTypeName(
        type.falseType,
        options,
      )}`;
    case 'indexedAccess':
      return `${renderSignatureTypeName(
        type.objectType,
        options,
      )}${signatureText('[')}${renderSignatureTypeName(
        type.indexType,
        options,
      )}${signatureText(']')}`;
    case 'inferred':
    case 'intrinsic':
      return signatureKeyword(type.name);
    case 'intersection':
      return type.types
        .map((item) => renderSignatureTypeName(item, options))
        .join(signatureText(' & '));
    case 'literal':
      return signatureText(JSON.stringify(type.value));
    case 'mapped':
      return signatureTypeToken('mapped object');
    case 'optional':
      return `${renderSignatureTypeName(
        type.elementType,
        options,
      )}${signatureText('?')}`;
    case 'predicate':
      return signatureText(typeName(type, options));
    case 'query':
      return `${signatureKeyword('typeof')} ${renderSignatureTypeName(
        type.queryType,
        options,
      )}`;
    case 'reference': {
      const expanded = sourceTypeEquivalent(type, {
        ...options,
        renderJSX: true,
      });
      if (expanded != null) {
        return expanded;
      }
      const name = type.name ?? type.qualifiedName;
      const target = targetId(type);
      const base =
        target != null && docsById.has(target)
          ? signatureTypeLink(name, target)
          : signatureTypeToken(name);
      const args = typeArguments(type, options);
      const typeArgs = args.length
        ? `${signatureText('<')}${args
            .map((arg) => renderSignatureTypeName(arg, options))
            .join(signatureText(', '))}${signatureText('>')}`
        : '';
      return `${base}${typeArgs}`;
    }
    case 'reflection':
      return renderSignatureReflectionType(type.declaration, options);
    case 'rest':
      return `${signatureText('...')}${renderSignatureTypeName(
        type.elementType,
        options,
      )}`;
    case 'templateLiteral':
      return signatureTypeToken('template literal');
    case 'tuple':
      return `${signatureText('[')}${type.elements
        .map((item) => renderSignatureTypeName(item, options))
        .join(signatureText(', '))}${signatureText(']')}`;
    case 'typeOperator':
      if (type.operator === 'readonly' && type.target?.type === 'array') {
        return `${signatureKeyword(
          'readonly',
        )} ${renderSignatureArrayElementType(
          type.target.elementType,
          options,
        )}${signatureText('[]')}`;
      }
      return `${signatureKeyword(type.operator)} ${renderSignatureTypeName(
        type.target,
        options,
      )}`;
    case 'union':
      return type.types
        .map((item) => renderSignatureTypeName(item, options))
        .join(signatureText(' | '));
    case 'unknown':
      return signatureTypeToken('unknown');
  }
  return signatureTypeToken(type.name ?? type.type ?? 'unknown');
}

function renderApiType(type, options = {}) {
  return `<ApiType>${renderSignatureTypeName(type, options)}</ApiType>`;
}

function typeParameterListJSX(node, options = {}) {
  const typeParameters = node.typeParameters ?? [];
  if (typeParameters.length === 0) {
    return '';
  }

  const params = typeParameters.map((param) => {
    const constraint =
      param.type == null
        ? ''
        : `${signatureText(' extends ')}${renderSignatureTypeName(
            param.type,
            options,
          )}`;
    const defaultType =
      param.default == null
        ? ''
        : `${signatureText(' = ')}${renderSignatureTypeName(
            param.default,
            options,
          )}`;
    return `${signatureTypeToken(param.name)}${constraint}${defaultType}`;
  });
  return `${signatureText('<')}${params.join(
    signatureText(', '),
  )}${signatureText('>')}`;
}

function renderSignatureDeclaration(
  signature,
  options = {},
  name = signature.name,
) {
  return `<ApiSignature>${signatureName(name)}${typeParameterListJSX(
    signature,
    options,
  )}${parameterListJSX(signature, options)}${signatureText(
    ': ',
  )}${renderSignatureTypeName(signature.type, options)}</ApiSignature>`;
}

function renderConstructorDeclaration(signature, options = {}) {
  return `<ApiSignature>${signatureKeyword('new')} ${signatureName(
    signature.name,
  )}${parameterListJSX(signature, options)}</ApiSignature>`;
}

function renderTypeAliasDeclaration(node, options = {}) {
  return `<ApiSignature>${signatureKeyword('type')} ${signatureName(
    node.name,
  )}${typeParameterListJSX(node, options)}${signatureText(
    ' = ',
  )}${renderSignatureTypeName(node.type, options)}${signatureText(
    ';',
  )}</ApiSignature>`;
}

function parameterList(signature, options = {}) {
  const params = (signature.parameters ?? [])
    .map(
      (param) =>
        `${param.name}${param.flags?.isOptional ? '?' : ''}: ${typeName(
          param.type,
          options,
        )}`,
    )
    .join(', ');
  return `(${params})`;
}

function renderParameterList(signature, options = {}) {
  const params = (signature.parameters ?? [])
    .map(
      (param) =>
        `${code(
          `${param.name}${param.flags?.isOptional ? '?' : ''}`,
        )}: ${renderType(param.type, options)}`,
    )
    .join(', ');
  return `(${params})`;
}

function parameterListJSX(signature, options = {}) {
  const params = (signature.parameters ?? [])
    .map(
      (param) =>
        `${signatureText(param.name)}${
          param.flags?.isOptional ? signatureText('?') : ''
        }${signatureText(': ')}${renderSignatureTypeName(param.type, options)}`,
    )
    .join(signatureText(', '));
  return `${signatureText('(')}${params}${signatureText(')')}`;
}

function declarationKind(node, siblings = []) {
  if (isEnumLikeDeclaration(node, siblings)) {
    return 'Enumerations';
  }
  if (node.kind === ReflectionKind.Class) {
    return 'Classes';
  }
  if (node.kind === ReflectionKind.Function) {
    return 'Functions';
  }
  if (node.kind === ReflectionKind.Variable) {
    return 'Constants';
  }
  if (node.kind === ReflectionKind.Enum) {
    return 'Enumerations';
  }
  if (
    node.kind === ReflectionKind.TypeAlias ||
    node.kind === ReflectionKind.Interface ||
    (node.kind === ReflectionKind.Reference && node.variant === 'declaration')
  ) {
    return 'Types';
  }
  return null;
}

function isEnumLikeDeclaration(node, siblings = []) {
  return isEnumNamespace(node) || isEnumLikeConstObject(node, siblings);
}

function isEnumLikeConstObject(node, siblings = []) {
  return (
    node.kind === ReflectionKind.Variable &&
    hasMatchingTypeAlias(node, siblings) &&
    enumLikeMembers(node).length > 0
  );
}

function isEnumLikeTypeAlias(node, siblings = []) {
  return (
    node.kind === ReflectionKind.TypeAlias &&
    siblings.some(
      (sibling) =>
        sibling !== node &&
        sibling.name === node.name &&
        isEnumLikeConstObject(sibling, siblings),
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
  return (node.type?.declaration?.children ?? []).filter(
    (child) =>
      child.variant !== 'reference' &&
      !child.flags?.isExternal &&
      !child.flags?.isInherited,
  );
}

function visibleChildren(node) {
  return (node.children ?? []).filter(
    (child) =>
      child.variant !== 'reference' &&
      !child.flags?.isExternal &&
      !child.flags?.isInherited,
  );
}

function renderComment(node) {
  const parts = [];
  if (tag(node.comment, '@deprecated') != null) {
    parts.push('<ApiTag kind="deprecated" />');
  }

  const text = summary(node);
  if (text) {
    parts.push(mdxMarkdown(text));
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
  const fields = [];
  let hasDefault = false;
  for (const child of children) {
    if (child.kind === ReflectionKind.Method) {
      lines.push(...renderCallable(child, level, child.name));
      continue;
    }
    const defaultValue = defaultText(child, parent, options);
    hasDefault ||= defaultValue !== '';
    fields.push([
      `${text(child.name)}${child.flags?.isOptional ? '?' : ''}`,
      renderApiType(child.type, options),
      defaultValue,
      summary(child),
    ]);
  }
  const headers = hasDefault
    ? ['Name', 'Type', 'Default', 'Description']
    : ['Name', 'Type', 'Description'];
  const rows = hasDefault
    ? fields
    : fields.map(([name, type, , description]) => [name, type, description]);
  return fields.length > 0
    ? [heading(level, 'Members'), ...table([headers, ...rows]), ...lines]
    : lines;
}

function renderParams(signature, level, options = {}) {
  const params = signature.parameters ?? [];
  if (params.length === 0) {
    return [];
  }

  const lines = [heading(level, 'Arguments')];
  let hasDefault = false;
  for (const param of signature.parameters ?? []) {
    const defaultValue = defaultText(param, signature, options);
    hasDefault ||= defaultValue !== '';
    lines.push([
      `${text(param.name)}${param.flags?.isOptional ? '?' : ''}`,
      renderApiType(param.type, options),
      defaultValue,
      summary(param),
    ]);
  }
  const headers = hasDefault
    ? ['Name', 'Type', 'Default', 'Description']
    : ['Name', 'Type', 'Description'];
  const rows = hasDefault
    ? lines.slice(1)
    : lines
        .slice(1)
        .map(([name, type, , description]) => [name, type, description]);
  return [lines[0], ...table([headers, ...rows])];
}

function renderExamples(comment, level) {
  const examples = (comment?.blockTags ?? []).filter(
    (block) => block.tag === '@example',
  );
  if (examples.length === 0) {
    return [];
  }

  return examples.flatMap((example, index) => [
    heading(level, examples.length === 1 ? 'Example' : `Example ${index + 1}`),
    renderParts(example.content).trim(),
  ]);
}

function renderReturns(signature, level, options = {}) {
  if (signature.type == null || typeName(signature.type, options) === 'void') {
    return [];
  }
  const returns = tagText(signature.comment, '@returns', {
    linkCodeSpans: true,
  });
  return [
    heading(level, 'Returns'),
    ...table([
      ['Type', 'Description'],
      [renderApiType(signature.type, options), returns],
    ]),
  ];
}

function renderTypeParameters(node, level, options = {}) {
  const typeParameters = node.typeParameters ?? [];
  if (typeParameters.length === 0) {
    return [];
  }

  const rows = typeParameters.map((param) => [
    param.name,
    param.type == null ? '' : renderApiType(param.type, options),
    param.default == null ? '' : renderApiType(param.default, options),
    summary(param),
  ]);
  return [
    heading(level, 'Type Parameters'),
    ...table([['Name', 'Constraint', 'Default', 'Description'], ...rows]),
  ];
}

function publishedExtendedTypes(node) {
  if (node.kind !== ReflectionKind.Interface) {
    return [];
  }

  return (node.extendedTypes ?? []).filter((type) => {
    const target = targetId(type);
    return target != null && docsById.has(target);
  });
}

function renderInterfaceDeclaration(node, options = {}) {
  const extendedTypes = publishedExtendedTypes(node);
  if (extendedTypes.length === 0) {
    return '';
  }

  return `<ApiSignature>${signatureKeyword('interface')} ${signatureName(
    node.name,
  )}${typeParameterListJSX(node, options)}${signatureText(
    ' extends ',
  )}${extendedTypes
    .map((type) => renderSignatureTypeName(type, options))
    .join(signatureText(', '))}</ApiSignature>`;
}

function renderCallable(
  node,
  level,
  label = `${node.name}()`,
  options = sourceOptions(node),
) {
  const signatures = node.signatures ?? [node];
  const lines = [heading(level, label.endsWith(')') ? label : `${label}()`)];

  for (const [index, signature] of signatures.entries()) {
    const overloadLabel =
      signatures.length > 1 ? `Overload ${index + 1}` : null;
    if (overloadLabel) {
      lines.push(heading(level + 1, overloadLabel));
    }

    const bodyLevel = overloadLabel ? level + 2 : level + 1;
    const comment = renderComment(signature);
    if (comment) {
      lines.push(comment);
    }
    lines.push(...renderTypeParameters(signature, bodyLevel, options));
    lines.push(
      '**Signature:**',
      renderSignatureDeclaration(signature, options),
    );
    lines.push(...renderParams(signature, bodyLevel, options));
    lines.push(...renderReturns(signature, bodyLevel, options));
    lines.push(...renderExamples(signature.comment, bodyLevel));
  }
  return lines;
}

function renderDeclaration(node, level = 3, siblings = []) {
  const lines = [];
  const options = sourceOptions(node);
  const title =
    node.kind === ReflectionKind.Function ? `${node.name}()` : node.name;
  lines.push(heading(level, title));

  const comment = renderComment(node);
  const label = typeLabel(node, siblings);
  if (label != null) {
    lines.push(comment ? `**${label}.** ${comment}` : `**${label}.**`);
  } else if (comment) {
    lines.push(comment);
  }

  if (node.kind === ReflectionKind.Function) {
    return renderCallable(node, level, title, options);
  }

  lines.push(...renderTypeParameters(node, level + 1, options));

  if (isEnumLikeDeclaration(node, siblings)) {
    lines.push(enumLikeNote(node));
    lines.push(...renderEnumMembers(node, level + 1, options));
    return lines;
  }

  const interfaceDeclaration = renderInterfaceDeclaration(node, options);
  if (interfaceDeclaration) {
    lines.push(interfaceDeclaration);
  }

  if (node.kind === ReflectionKind.Variable) {
    lines.push(renderApiType(node.type, options));
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
    const rows = visibleChildren(node).map((child) => [
      code(child.name),
      code(typeName(child.type, options)),
      summary(child),
    ]);
    lines.push(heading(level + 1, 'Members'));
    lines.push(...table([['Name', 'Value', 'Description'], ...rows]));
    return lines;
  }

  if (node.kind === ReflectionKind.Class) {
    const constructors = visibleChildren(node).filter(
      (child) => child.kind === ReflectionKind.Constructor,
    );
    for (const constructor of constructors) {
      for (const signature of constructor.signatures ?? []) {
        lines.push(heading(level + 1, 'Constructor'));
        const comment = renderComment(signature);
        if (comment) {
          lines.push(comment);
        }
        lines.push(
          '**Signature:**',
          renderConstructorDeclaration(signature, options),
        );
        lines.push(...renderParams(signature, level + 2, options));
        lines.push(...renderReturns(signature, level + 2, options));
      }
    }
  }

  lines.push(...renderFields(node, level + 1, options));
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

function renderEnumMembers(node, level, options = {}) {
  const rows = enumLikeMembers(node).map((child) => [
    code(child.name),
    code(typeName(child.type, options)),
    summary(child),
  ]);
  if (rows.length === 0) {
    return [];
  }
  return [
    heading(level, 'Members'),
    ...table([['Name', 'Value', 'Description'], ...rows]),
  ];
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
  if (
    node.kind === ReflectionKind.Enum ||
    isEnumLikeDeclaration(node, siblings)
  ) {
    return 'Enumeration';
  }
  if (node.kind === ReflectionKind.Interface) {
    return 'Interface';
  }
  if (
    node.kind === ReflectionKind.TypeAlias ||
    (node.kind === ReflectionKind.Reference && node.variant === 'declaration')
  ) {
    return 'Type alias';
  }
  return null;
}

function pageFor(moduleName, node, siblings = []) {
  const itemCategory = category(node, siblings);
  return itemCategory == null
    ? moduleName
    : `${moduleName}/${slug(itemCategory)}`;
}

function indexReflections(doc) {
  docsById = new Map();
  docsBySymbol = new Map();
  typeParameterDefaultsById = new Map();

  for (const module of doc.children ?? []) {
    const moduleName = module.name === 'index' ? 'graphql' : module.name;
    addSymbolDoc(moduleName, { page: moduleName });
    const children = visibleChildren(module);
    for (const child of children) {
      if (moduleName === 'graphql' && !rootExportNames.has(child.name)) {
        continue;
      }
      const page = pageFor(moduleName, child, children);
      const childDoc = { page, anchor: slug(child.name) };
      docsById.set(child.id, childDoc);
      addSymbolDoc(child.name, childDoc);
      typeParameterDefaultsById.set(
        child.id,
        (child.typeParameters ?? []).map((param) => param.default ?? null),
      );
      for (const member of visibleChildren(child)) {
        const memberDoc = { page, anchor: slug(member.name) };
        docsById.set(member.id, memberDoc);
        addSymbolDoc(`${child.name}.${member.name}`, memberDoc);
      }
      for (const signature of child.signatures ?? []) {
        docsById.set(signature.id, childDoc);
      }
    }
  }
}

function addSymbolDoc(symbol, doc) {
  const docs = docsBySymbol.get(symbol);
  if (docs == null) {
    docsBySymbol.set(symbol, [doc]);
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
  return [
    heading(level, title),
    ...items.flatMap((item) => renderDeclaration(item, level + 1, allItems)),
  ];
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

function renderItems(title, intro, items) {
  const lines = [heading(1, title)];
  if (intro) {
    lines.push(intro);
  }
  const groups = grouped(items);
  for (const group of groupOrder) {
    lines.push(...renderGroup(group, groups.get(group), 2, items));
  }
  return lines.filter(Boolean).join('\n\n').trimEnd() + '\n';
}

function addApiTagImport(page, content) {
  const imports = [];
  if (content.includes('<ApiSignature')) {
    imports.push('ApiSignature');
  }
  if (content.includes('<ApiType>')) {
    imports.push('ApiType');
  }
  if (content.includes('<ApiTag ')) {
    imports.push('ApiTag');
  }
  if (imports.length === 0) {
    return content;
  }
  const importPath = page.includes('/')
    ? '../../../components/ApiTags'
    : '../../components/ApiTags';
  return `import { ${imports.join(', ')} } from '${importPath}';\n\n${content}`;
}

function writePage(page, content) {
  const path = join(outputDir, `${page}.mdx`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, addApiTagImport(page, content));
}

function moduleIntro(module) {
  return summary(module);
}

function renderDocs(doc) {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  indexReflections(doc);

  const meta = [];
  for (const module of doc.children ?? []) {
    const moduleName = module.name === 'index' ? 'graphql' : module.name;
    const moduleTitle =
      moduleName === 'graphql' ? 'graphql' : `graphql/${moduleName}`;
    const allItems = visibleChildren(module).filter(
      (item) => moduleName !== 'graphql' || rootExportNames.has(item.name),
    );

    if (moduleName === 'graphql') {
      meta.unshift([moduleName, moduleTitle]);
    } else {
      meta.push([moduleName, moduleTitle]);
    }
    const categories = categoriesForItems(allItems);
    const byCategory = new Map(categories.map((name) => [name, []]));
    const leftovers = [];
    for (const item of allItems) {
      const itemCategory = category(item, allItems);
      if (itemCategory != null && byCategory.has(itemCategory)) {
        byCategory.get(itemCategory).push(item);
      } else {
        leftovers.push(item);
      }
    }

    const visibleCategories = categories.filter(
      (name) => byCategory.get(name).length > 0,
    );
    if (leftovers.length > 0) {
      fail(
        `Missing @category in ${moduleTitle}: ` +
          leftovers.map((item) => item.name).join(', '),
      );
    }
    const links = visibleCategories
      .map((name) => `- [${name}](${docsBasePath}/${moduleName}/${slug(name)})`)
      .join('\n');
    writePage(
      moduleName,
      [
        heading(1, moduleTitle),
        moduleIntro(module),
        visibleCategories.length
          ? `${heading(2, 'Categories')}\n\n${links}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n') + '\n',
    );

    if (visibleCategories.length > 0) {
      const dir = join(outputDir, moduleName);
      mkdirSync(dir, { recursive: true });
      writeMeta(
        dir,
        visibleCategories.map((name) => [slug(name), name]),
      );
      for (const name of visibleCategories) {
        const categoryTitle =
          moduleName === 'graphql'
            ? `graphql/${slug(name)}`
            : `graphql/${moduleName}/${slug(name)}`;
        writePage(
          `${moduleName}/${slug(name)}`,
          renderItems(categoryTitle, '', byCategory.get(name)),
        );
      }
    }
  }

  writeMeta(outputDir, meta);
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

function prepareSourceSnapshot() {
  // Snapshot the source before running TypeDoc so generation-only compatibility
  // fixes never mutate the working tree.
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(tmpSourceDir, { recursive: true });

  cpSync(join(sourceDir, 'src'), join(tmpSourceDir, 'src'), {
    recursive: true,
  });
  inheritFileCategories(join(tmpSourceDir, 'src'));
  sourceMetadata = collectSourceMetadata(join(tmpSourceDir, 'src'));

  const tsconfig = sanitizeTsConfig(
    readTsConfig(join(sourceDir, 'tsconfig.json')),
  );
  writeJson(join(tmpSourceDir, 'tsconfig.json'), tsconfig);

  const tsdocPath = join(sourceDir, 'tsdoc.json');
  if (existsSync(tsdocPath)) {
    cpSync(tsdocPath, join(tmpSourceDir, 'tsdoc.json'));
  }

  const typedocOptions = readJson(typedocTemplatePath);
  typedocOptions.name = `GraphQL.js v${docsVersionLabel.slice(5)} API`;
  typedocOptions.entryPoints = [
    join(tmpSourceDir, 'src/error/index.ts'),
    join(tmpSourceDir, 'src/execution/index.ts'),
    join(tmpSourceDir, 'src/language/index.ts'),
    join(tmpSourceDir, 'src/subscription/index.ts'),
    join(tmpSourceDir, 'src/type/index.ts'),
    join(tmpSourceDir, 'src/utilities/index.ts'),
    join(tmpSourceDir, 'src/validation/index.ts'),
    join(tmpSourceDir, 'src/index.ts'),
  ].filter((path) => existsSync(path));
  typedocOptions.json = jsonPath;
  typedocOptions.tsconfig = join(tmpSourceDir, 'tsconfig.json');
  typedocOptions.disableSources = false;
  writeJson(typedocOptionsPath, typedocOptions);
}

function generateForRef(ref, index, generatedMajors) {
  const sourceCheckoutDir = checkoutSourceRef(ref, index);
  const majorVersion = configureGeneration(ref, sourceCheckoutDir);
  if (generatedMajors.has(majorVersion)) {
    fail(
      `Multiple refs resolve to v${majorVersion}; refusing to overwrite docs.`,
    );
  }
  generatedMajors.add(majorVersion);
  prepareSourceSnapshot();
  rootExportNames = collectRootExportNames();
  console.log(`[${docsVersionLabel}] Copied source snapshot from:`, ref);
  run(
    'npm',
    [
      '--prefix',
      apiDocsDir,
      'exec',
      'typedoc',
      '--',
      '--options',
      typedocOptionsPath,
    ],
    repoRoot,
  );

  if (!existsSync(jsonPath)) {
    fail('TypeDoc did not emit JSON docs.');
  }

  renderDocs(readJson(jsonPath));
}

try {
  const refs = process.argv.slice(2);
  if (refs.length === 0) {
    fail('Usage: npm run generate:docs -- <branch-or-ref> [...branch-or-ref]');
  }

  const generatedMajors = new Set();
  for (const [index, ref] of refs.entries()) {
    generateForRef(ref, index, generatedMajors);
  }
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
