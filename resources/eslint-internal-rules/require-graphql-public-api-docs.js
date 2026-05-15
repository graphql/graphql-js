'use strict';

const { isJsdoc, parseTags } = require('./jsdoc-utils.js');

module.exports = {
  meta: {
    schema: [],
  },
  create: requireGraphqlPublicApiDocs,
};

function requireGraphqlPublicApiDocs(context) {
  const sourceCode = context.getSourceCode();

  function report(node, message) {
    context.report({ node, message });
  }

  function commentFor(node) {
    const target =
      node.parent?.type === 'ExportNamedDeclaration' &&
      node.parent.declaration === node
        ? node.parent
        : node;
    const comments = sourceCode.getCommentsBefore(target).filter(isJsdoc);
    const comment = comments[comments.length - 1];
    if (comment == null || hasCodeBetween(comment, target)) {
      return null;
    }
    return comment;
  }

  function hasCodeBetween(comment, node) {
    return sourceCode
      .getTokensBetween(comment, node, { includeComments: true })
      .some((token) => token.type !== 'Block' && token.type !== 'Line');
  }

  function parsedCommentFor(node) {
    const comment =
      node.type === 'Program' ? topComment(node) : commentFor(node);
    return comment == null ? null : { tags: parseTags(comment) };
  }

  function topComment(program) {
    const first = program.body[0];
    const comments =
      first == null
        ? sourceCode.getAllComments()
        : sourceCode.getCommentsBefore(first);
    return comments.find(isJsdoc) ?? null;
  }

  function checkPublicDoc(node, label, fileCategory, options = {}) {
    const comment = parsedCommentFor(node);
    if (comment == null || comment.tags.has('internal')) {
      return;
    }

    // eslint-plugin-jsdoc owns generic public documentation shape checks such as
    // descriptions, params, and returns. This rule only keeps the GraphQL-
    // specific contract that the plugin cannot express: public docs are
    // categorized either directly or by the file-level package documentation,
    // and TypeScript type parameters are documented with @typeParam.
    if (
      options.requireCategory !== false &&
      !comment.tags.has('category') &&
      fileCategory == null
    ) {
      report(node, `${label} is missing @category.`);
    }

    requireNamedTags(
      node,
      comment,
      'typeParam',
      typeParameterNames(node),
      label,
    );
  }

  function checkPublicMemberDocs(declaration, ownerName) {
    for (const member of publicMembers(declaration)) {
      checkPublicDoc(member, memberLabel(ownerName, member), null, {
        requireCategory: false,
      });
    }
  }

  function requireNamedTags(node, comment, tag, requiredNames, label) {
    const documented = comment.tags.get(tag) ?? new Map();
    for (const name of requiredNames) {
      if (!documented.has(name) || documented.get(name) === '') {
        report(node, `${label} is missing @${tag} ${name}.`);
      }
    }
  }

  return {
    'Program:exit'(program) {
      const moduleComment = parsedCommentFor(program);
      const fileCategory =
        moduleComment?.tags.get('category')?.get('*') ?? null;

      for (const statement of program.body) {
        const namespaceName = namespaceExportName(statement);
        if (namespaceName != null) {
          checkPublicDoc(statement, namespaceName, fileCategory);
        }

        const declaration = unwrapExportedDeclaration(statement);
        if (!isDocumentableDeclaration(declaration)) {
          continue;
        }
        for (const name of declarationNames(declaration)) {
          checkPublicDoc(declaration, name, fileCategory);
          checkPublicMemberDocs(declaration, name);
        }
      }
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

function typeParameterNames(node) {
  const typeParameters = node.value?.typeParameters ?? node.typeParameters;
  return (typeParameters?.params ?? [])
    .map((param) => param.name?.name)
    .filter(Boolean);
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

function publicMembers(declaration) {
  if (declaration.type === 'ClassDeclaration') {
    return declaration.body.body.filter(
      (member) => member.accessibility !== 'private',
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
  return [];
}

function isDocumentableTypeMember(member) {
  return member.type !== 'TSIndexSignature';
}

function memberLabel(ownerName, member) {
  const key = member.key ?? member.id;
  if (member.kind === 'constructor') {
    return `${ownerName}.constructor`;
  }
  if (key?.type === 'Identifier') {
    return `${ownerName}.${key.name}`;
  }
  if (key?.type === 'Literal') {
    return `${ownerName}.${String(key.value)}`;
  }
  return `${ownerName}.<computed>`;
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
