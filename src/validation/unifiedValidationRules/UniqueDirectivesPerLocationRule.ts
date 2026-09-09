/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ASTNode, DirectiveNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import {
  isTypeDefinitionNode,
  isTypeExtensionNode,
} from '../../language/predicates.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { GraphQLSchemaElement } from '../../type/definition.ts';
import { specifiedDirectives } from '../../type/directives.ts';
import type { GraphQLSchema } from '../../type/schema.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Non-repeatable directives must not be applied more than once at the same
 * location.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Unique-Per-Location
 * @category Validation Rules
 * @internal
 */
export const UniqueDirectivesPerLocationASTVisitor: ASTVisitorFn = (
  context,
) => {
  const schema = context.index.schema;
  const definedDirectives =
    schema == null ? specifiedDirectives : schema.getDirectives();
  const schemaDirectives =
    schema == null
      ? new Map<string, DirectiveNode | undefined>()
      : getSeenDirectiveUsages(schema);
  const typeDirectivesMap = new Map<
    string,
    Map<string, DirectiveNode | undefined>
  >();
  const directiveDirectivesMap = new Map<
    string,
    Map<string, DirectiveNode | undefined>
  >();
  const directiveListDirectivesMap = new Map<
    ReadonlyArray<DirectiveNode>,
    Map<string, DirectiveNode | undefined>
  >();

  const visitor: ASTVisitor = {
    enter(node) {
      if (!('directives' in node) || node.directives == null) {
        return;
      }

      const seenDirectives = getSeenDirectives(node, node.directives);
      const isNonRepeatable = isTypeSystemDirectiveParent(node)
        ? isNonRepeatableDirective
        : (directiveName: string) =>
            context.index.isDirectiveRepeatable(directiveName) === false;
      for (const directive of node.directives) {
        validateDirective(directive, seenDirectives, isNonRepeatable);
      }
    },
  };

  return visitor;

  function validateDirective(
    directive: DirectiveNode,
    seenDirectives: Map<string, DirectiveNode | undefined>,
    isNonRepeatable: (directiveName: string) => boolean,
  ): void {
    const directiveName = directive.name.value;

    if (isNonRepeatable(directiveName)) {
      if (seenDirectives.has(directiveName)) {
        const seenDirective = seenDirectives.get(directiveName);
        context.reportError(
          new GraphQLError(
            duplicateDirectivePerLocationMessage(directiveName),
            {
              nodes:
                seenDirective == null ? directive : [seenDirective, directive],
            },
          ),
        );
      } else {
        seenDirectives.set(directiveName, directive);
      }
    }
  }

  function getSeenDirectives(
    node: ASTNode,
    directiveList: ReadonlyArray<DirectiveNode>,
  ): Map<string, DirectiveNode | undefined> {
    if (
      node.kind === Kind.SCHEMA_DEFINITION ||
      node.kind === Kind.SCHEMA_EXTENSION
    ) {
      return schemaDirectives;
    }
    if (isTypeDefinitionNode(node) || isTypeExtensionNode(node)) {
      return getTypeSeenDirectives(node.name.value);
    }
    if (
      node.kind === Kind.DIRECTIVE_DEFINITION ||
      node.kind === Kind.DIRECTIVE_EXTENSION
    ) {
      return getDirectiveSeenDirectives(node.name.value);
    }
    return getDirectiveListSeenDirectives(directiveList);
  }

  function getDirectiveListSeenDirectives(
    directiveList: ReadonlyArray<DirectiveNode>,
  ): Map<string, DirectiveNode | undefined> {
    let seenDirectives = directiveListDirectivesMap.get(directiveList);
    if (seenDirectives == null) {
      seenDirectives = new Map();
      directiveListDirectivesMap.set(directiveList, seenDirectives);
    }
    return seenDirectives;
  }

  function getTypeSeenDirectives(
    typeName: string,
  ): Map<string, DirectiveNode | undefined> {
    let seenDirectives = typeDirectivesMap.get(typeName);
    if (seenDirectives != null) {
      return seenDirectives;
    }

    const type = schema?.getType(typeName);
    seenDirectives = type == null ? new Map() : getSeenDirectiveUsages(type);
    typeDirectivesMap.set(typeName, seenDirectives);
    return seenDirectives;
  }

  function getDirectiveSeenDirectives(
    directiveName: string,
  ): Map<string, DirectiveNode | undefined> {
    let seenDirectives = directiveDirectivesMap.get(directiveName);
    if (seenDirectives != null) {
      return seenDirectives;
    }

    const directive = definedDirectives.find(
      (definition) => definition.name === directiveName,
    );
    seenDirectives =
      directive == null ? new Map() : getSeenDirectiveUsages(directive);
    directiveDirectivesMap.set(directiveName, seenDirectives);
    return seenDirectives;
  }

  function isNonRepeatableDirective(directiveName: string): boolean {
    return (
      isSpecifiedDirectiveUsageName(directiveName) ||
      context.index.isDirectiveRepeatable(directiveName) === false
    );
  }
};

/** Direct validation variant of {@link UniqueDirectivesPerLocationASTVisitor}.
 * @internal
 */
export const UniqueDirectivesPerLocationTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (!index.shouldValidateSchemaOnlyElements()) {
      return;
    }

    const seenDirectivesByElement = new Map<
      GraphQLSchema | GraphQLSchemaElement,
      string | Set<string>
    >();

    for (const { name, element } of index.getSchemaValidationElements()
      .directiveUsages) {
      const seenDirectives = seenDirectivesByElement.get(element);
      if (seenDirectives == null) {
        seenDirectivesByElement.set(element, name);
        continue;
      }

      if (typeof seenDirectives === 'string') {
        if (seenDirectives === name) {
          index.reportError(duplicateDirectivePerLocationMessage(name));
        } else {
          seenDirectivesByElement.set(element, new Set([seenDirectives, name]));
        }
        continue;
      }

      if (seenDirectives.has(name)) {
        index.reportError(duplicateDirectivePerLocationMessage(name));
      } else {
        seenDirectives.add(name);
      }
    }
  };

function isTypeSystemDirectiveParent(node: ASTNode): boolean {
  return (
    node.kind !== Kind.OPERATION_DEFINITION &&
    node.kind !== Kind.VARIABLE_DEFINITION &&
    node.kind !== Kind.FIELD &&
    node.kind !== Kind.FRAGMENT_SPREAD &&
    node.kind !== Kind.INLINE_FRAGMENT &&
    node.kind !== Kind.FRAGMENT_DEFINITION
  );
}

function duplicateDirectivePerLocationMessage(directiveName: string): string {
  return `The directive "@${directiveName}" can only be used once at this location.`;
}

function getSeenDirectiveUsages(
  element: GraphQLSchema | GraphQLSchemaElement,
): Map<string, DirectiveNode | undefined> {
  const seenDirectives = new Map<string, DirectiveNode | undefined>();
  addSeenDirectiveUsageName(seenDirectives, 'deprecated', element);
  addSeenDirectiveUsageName(seenDirectives, 'specifiedBy', element);
  addSeenDirectiveUsageName(seenDirectives, 'oneOf', element);

  return seenDirectives;
}

function addSeenDirectiveUsageName(
  seenDirectives: Map<string, DirectiveNode | undefined>,
  directiveName: 'deprecated' | 'specifiedBy' | 'oneOf',
  element: GraphQLSchema | GraphQLSchemaElement,
): void {
  if (
    (directiveName === 'deprecated' &&
      'deprecationReason' in element &&
      element.deprecationReason != null) ||
    (directiveName === 'specifiedBy' &&
      'specifiedByURL' in element &&
      element.specifiedByURL != null) ||
    (directiveName === 'oneOf' &&
      'isOneOf' in element &&
      element.isOneOf === true)
  ) {
    seenDirectives.set(directiveName, undefined);
  }
}

function isSpecifiedDirectiveUsageName(directiveName: string): boolean {
  return (
    directiveName === 'deprecated' ||
    directiveName === 'specifiedBy' ||
    directiveName === 'oneOf'
  );
}
