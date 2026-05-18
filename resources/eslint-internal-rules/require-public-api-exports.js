import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { hasTag, isJsdoc } from './jsdoc-utils.js';

const publicExportsCache = new Map();

const requirePublicApiExportsRule = {
  'require-public-api-exports': {
    meta: {
      schema: [
        {
          type: 'object',
          properties: {
            publicIndexFiles: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          additionalProperties: false,
        },
      ],
    },
    create: requirePublicApiExports,
  },
};

function requirePublicApiExports(context) {
  const sourceCode = context.getSourceCode();
  const publicApi = createPublicApi(context);

  function hasPublicDoc(node) {
    const comment = ownJsdocComment(node);
    return comment != null && !hasNonPublicTag(comment);
  }

  function hasInternalDoc(node) {
    const comment = ownJsdocComment(node);
    return comment != null && hasNonPublicTag(comment);
  }

  function hasNonPublicTag(comment) {
    return hasTag(comment, 'internal') || hasTag(comment, 'private');
  }

  function ownJsdocComment(node) {
    const parent = node.parent;
    const commentTarget =
      parent?.type === 'ExportNamedDeclaration' && parent.declaration === node
        ? parent
        : node;
    const comments = sourceCode
      .getCommentsBefore(commentTarget)
      .filter(isJsdoc);
    const comment = comments[comments.length - 1];
    if (comment == null || hasCodeBetween(comment, commentTarget)) {
      return null;
    }
    return comment;
  }

  function hasCodeBetween(comment, node) {
    return sourceCode
      .getTokensBetween(comment, node, { includeComments: true })
      .some((token) => token.type !== 'Block' && token.type !== 'Line');
  }

  function reportMissingPublicDoc(node, name) {
    context.report({
      node,
      message: `Public API declaration "${name}" is exported by a public index.ts file and must have public JSDoc.`,
    });
  }

  function reportUnexpectedInternalDoc(node, name) {
    context.report({
      node,
      message: `Public API declaration "${name}" is exported by a public index.ts file and must not have @internal or @private JSDoc.`,
    });
  }

  function reportMissingInternalDoc(node, name) {
    context.report({
      node,
      message: `Internal declaration "${name}" is exported from src but is not exported by a public index.ts file and must have @internal or @private JSDoc.`,
    });
  }

  function requirePublicDoc(node, name) {
    if (!hasPublicDoc(node)) {
      reportMissingPublicDoc(node, name);
    }
  }

  return {
    ExportNamedDeclaration(node) {
      publicApi.trackLocalExports(node);
    },
    'Program:exit'(program) {
      // This rule owns the repo-specific public API boundary. Exported
      // declarations under src are public when they are re-exported by any
      // non-test src/**/index.ts package entrypoint; otherwise they are
      // internal and must be marked explicitly.
      const topLevelOverloads = overloadCounts(
        program.body,
        (statement) => unwrapExportedDeclaration(statement)?.id?.name,
      );

      for (const statement of program.body) {
        const namespaceName = namespaceExportName(statement);
        if (namespaceName != null) {
          if (publicApi.isPublic(namespaceName)) {
            if (hasInternalDoc(statement)) {
              reportUnexpectedInternalDoc(statement, namespaceName);
            }
            requirePublicDoc(statement, namespaceName);
          } else if (!hasInternalDoc(statement)) {
            reportMissingInternalDoc(statement, namespaceName);
          }
        }

        const declaration = publicApi.exportedDeclaration(statement);
        if (isDocumentableDeclaration(declaration)) {
          for (const name of declarationNames(declaration)) {
            if (publicApi.isPublic(name)) {
              if (
                isOverloadImplementation(declaration, topLevelOverloads, name)
              ) {
                if (!hasInternalDoc(declaration)) {
                  reportMissingInternalDoc(declaration, name);
                }
                continue;
              }
              if (hasInternalDoc(declaration)) {
                reportUnexpectedInternalDoc(declaration, name);
              }
              requirePublicDoc(declaration, name);
              for (const member of publicMembers(declaration)) {
                const qualifiedMemberName = `${name}.${memberName(member)}`;
                if (!hasInternalDoc(member)) {
                  requirePublicDoc(member, qualifiedMemberName);
                }
              }
            } else if (!hasInternalDoc(declaration)) {
              reportMissingInternalDoc(declaration, name);
            }
          }
        }
      }
    },
  };
}

function createPublicApi(context) {
  const cwd = context.cwd;
  const filename = normalizePath(path.relative(cwd, context.filename));
  const publicIndexFiles =
    context.options[0]?.publicIndexFiles ?? findIndexFiles(cwd);
  const publicExports = collectPublicExports(cwd, publicIndexFiles);
  const names = allPublicNamesForFile(publicExports, filename);
  const localExports = new Set();

  return {
    isPublic: (name) => names.has(name),
    trackLocalExports(node) {
      if (node.source != null || node.specifiers == null) {
        return;
      }
      for (const specifier of node.specifiers) {
        if (specifier.local?.name != null) {
          localExports.add(specifier.local.name);
        }
      }
    },
    exportedDeclaration(statement) {
      if (statement.type === 'ExportNamedDeclaration') {
        return isDocumentableDeclaration(statement.declaration)
          ? statement.declaration
          : null;
      }
      if (
        isDocumentableDeclaration(statement) &&
        declarationNames(statement).some((name) => localExports.has(name))
      ) {
        return statement;
      }
      return null;
    },
  };
}

function unwrapExportedDeclaration(statement) {
  return statement.type === 'ExportNamedDeclaration'
    ? statement.declaration
    : statement;
}

function namespaceExportName(statement) {
  return statement.type === 'ExportAllDeclaration'
    ? statement.exported?.name
    : null;
}

function findIndexFiles(cwd, dir = 'src') {
  const absoluteDir = path.join(cwd, dir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const file = normalizePath(path.join(dir, entry.name));
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('__')) {
        files.push(...findIndexFiles(cwd, file));
      }
    } else if (entry.isFile() && entry.name === 'index.ts') {
      files.push(file);
    }
  }
  return files.sort();
}

function collectPublicExports(cwd, publicIndexFiles) {
  const cacheKey = `${cwd}\0${publicIndexFiles.join('\0')}`;
  const cached = publicExportsCache.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  const exportTables = new Map();
  const publicExports = new Map();

  function exportTable(indexFile) {
    const cachedTable = exportTables.get(indexFile);
    if (cachedTable != null) {
      return cachedTable;
    }

    const table = new Map();
    exportTables.set(indexFile, table);

    const ast = sourceFile(cwd, indexFile);
    for (const statement of ast.statements) {
      if (ts.isExportDeclaration(statement)) {
        addExportDeclaration(table, statement, indexFile);
      } else if (hasExportModifier(statement)) {
        for (const name of tsDeclarationNames(statement)) {
          addExportedOrigin(table, name, { file: indexFile, name });
        }
      }
    }

    return table;
  }

  function addExportDeclaration(table, statement, file) {
    if (
      statement.moduleSpecifier == null ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return;
    }

    const targetFile = resolveModule(cwd, file, statement.moduleSpecifier.text);
    if (targetFile == null) {
      return;
    }

    if (statement.exportClause == null) {
      return;
    }

    if (ts.isNamespaceExport(statement.exportClause)) {
      const namespaceName = statement.exportClause.name.text;
      addExportedOrigin(table, namespaceName, { file, name: namespaceName });

      const targetTable = exportTable(targetFile);
      for (const origins of targetTable.values()) {
        for (const origin of origins) {
          addExportedOrigin(table, namespaceName, origin);
        }
      }
      return;
    }

    if (!ts.isNamedExports(statement.exportClause)) {
      return;
    }

    const targetTable = exportTable(targetFile);

    for (const element of statement.exportClause.elements) {
      const importedName = (element.propertyName ?? element.name).text;
      const exportedName = element.name.text;
      const origins = targetTable?.get(importedName) ?? [
        { file: targetFile, name: importedName },
      ];
      for (const origin of origins) {
        addExportedOrigin(table, exportedName, origin);
      }
    }
  }

  for (const indexFile of publicIndexFiles) {
    const table = exportTable(indexFile);
    const exportsForIndex = new Map();
    for (const origins of table.values()) {
      for (const origin of origins) {
        addPublicExport(exportsForIndex, origin.file, origin.name);
      }
    }
    publicExports.set(indexFile, exportsForIndex);
  }

  publicExportsCache.set(cacheKey, publicExports);
  return publicExports;
}

function allPublicNamesForFile(publicExports, file) {
  const names = new Set();
  for (const exportsForIndex of publicExports.values()) {
    for (const name of exportsForIndex.get(file) ?? []) {
      names.add(name);
    }
  }
  return names;
}

function sourceFile(cwd, file) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(path.join(cwd, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
}

function resolveModule(cwd, indexFile, specifier) {
  const base = normalizePath(path.join(path.dirname(indexFile), specifier));
  const candidates = specifier.endsWith('.ts')
    ? [base]
    : [`${base}.ts`, path.join(base, 'index.ts')];
  return candidates.find((file) => fs.existsSync(path.join(cwd, file)));
}

function addExportedOrigin(table, exportedName, origin) {
  if (!table.has(exportedName)) {
    table.set(exportedName, []);
  }
  table.get(exportedName).push(origin);
}

function addPublicExport(map, file, name) {
  if (!map.has(file)) {
    map.set(file, new Set());
  }
  map.get(file).add(name);
}

function hasExportModifier(node) {
  return node.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );
}

function tsDeclarationNames(node) {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .map((declaration) =>
        ts.isIdentifier(declaration.name) ? declaration.name.text : null,
      )
      .filter(Boolean);
  }
  return node.name?.text == null ? [] : [node.name.text];
}

function publicMembers(declaration) {
  if (declaration.type === 'ClassDeclaration') {
    const overloads = overloadCounts(declaration.body.body, memberName);
    return declaration.body.body.filter(
      (member) =>
        member.accessibility !== 'private' &&
        !isOverloadImplementation(member, overloads, memberName(member)),
    );
  }
  if (declaration.type === 'TSInterfaceDeclaration') {
    return declaration.body.body.filter(isDocumentableTypeMember);
  }
  if (declaration.type === 'TSTypeAliasDeclaration') {
    return typeLiteralMembers(declaration.typeAnnotation).filter(
      isDocumentableTypeMember,
    );
  }
  if (declaration.type === 'TSEnumDeclaration') {
    return declaration.members;
  }
  return [];
}

function overloadCounts(nodes, nameOfNode) {
  const counts = new Map();
  for (const node of nodes) {
    const name = nameOfNode(node);
    if (name != null) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

function isOverloadImplementation(node, overloads, name) {
  return (
    isCallable(node) && overloads.get(name) > 1 && callableBody(node) != null
  );
}

function typeLiteralMembers(typeAnnotation) {
  if (typeAnnotation == null) {
    return [];
  }
  if (typeAnnotation.type === 'TSTypeLiteral') {
    return typeAnnotation.members;
  }
  if (
    typeAnnotation.type === 'TSIntersectionType' ||
    typeAnnotation.type === 'TSUnionType'
  ) {
    return typeAnnotation.types.flatMap(typeLiteralMembers);
  }
  return [];
}

function isCallable(node) {
  return (
    node?.type === 'FunctionDeclaration' ||
    node?.type === 'MethodDefinition' ||
    node?.type === 'TSDeclareFunction' ||
    node?.type === 'TSMethodSignature'
  );
}

function callableBody(node) {
  return node.body ?? node.value?.body;
}

function isDocumentableTypeMember(member) {
  return member.type !== 'TSIndexSignature';
}

function isDocumentableDeclaration(node) {
  return (
    node?.type === 'ClassDeclaration' ||
    node?.type === 'FunctionDeclaration' ||
    node?.type === 'TSDeclareFunction' ||
    node?.type === 'TSInterfaceDeclaration' ||
    node?.type === 'TSTypeAliasDeclaration' ||
    node?.type === 'TSEnumDeclaration' ||
    node?.type === 'VariableDeclaration'
  );
}

function declarationNames(node) {
  if (node.type === 'VariableDeclaration') {
    return node.declarations
      .map((declaration) =>
        declaration.id.type === 'Identifier' ? declaration.id.name : null,
      )
      .filter(Boolean);
  }
  return node.id?.name == null ? [] : [node.id.name];
}

function memberName(member) {
  const key = member.key ?? member.id;
  if (member.kind === 'constructor') {
    return 'constructor';
  }
  if (key?.type === 'Identifier') {
    return key.name;
  }
  if (key?.type === 'Literal') {
    return String(key.value);
  }
  return '<computed>';
}

function normalizePath(file) {
  return file.split(path.sep).join('/');
}

export { requirePublicApiExportsRule };
