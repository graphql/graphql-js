/** @category Validation Rules */

import type { ObjMap } from '../../jsutils/ObjMap.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DirectiveDefinitionNode,
  DirectiveExtensionNode,
  DirectiveNode,
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  NamedTypeNode,
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import { visit } from '../../language/visitor.ts';

import type { GraphQLInputType } from '../../type/definition.ts';
import {
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInputType,
} from '../../type/definition.ts';
import type { GraphQLDirective } from '../../type/directives.ts';
import { isSpecifiedDirective } from '../../type/directives.ts';

import type { SDLValidationContext } from '../ValidationContext.ts';

type ReferenceNode =
  | DirectiveNode
  | NamedTypeNode
  | EnumValueDefinitionNode
  | InputValueDefinitionNode;
type TypeReferenceSourceNode =
  | ScalarTypeDefinitionNode
  | ScalarTypeExtensionNode
  | EnumTypeDefinitionNode
  | EnumTypeExtensionNode
  | InputObjectTypeDefinitionNode
  | InputObjectTypeExtensionNode;
type ChildReferenceSourceNode =
  | EnumValueDefinitionNode
  | InputValueDefinitionNode;

interface ReferenceSource {
  readonly coordinate: string;
  readonly directiveName?: string;
  readonly isFromDocument: boolean;
}

interface Reference extends ReferenceSource {
  readonly node?: ReferenceNode;
}

/**
 * No directive definition cycles
 *
 * The graph of directives used within directive definitions must not form any
 * cycles including referencing itself. This includes directives used on
 * directive arguments and, when the experimental syntax is enabled, directives
 * applied directly to directive definitions and extensions.
 *
 * See https://spec.graphql.org/draft/#sec-Type-System.Directives
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql';
 * import { NoDirectiveDefinitionCyclesRule } from 'graphql/validation';
 *
 * const invalidSDL = `
 *   directive @a(arg: String @b) on ARGUMENT_DEFINITION
 *   directive @b(arg: String @a) on ARGUMENT_DEFINITION
 *   type Query { name: String }
 * `;
 *
 * NoDirectiveDefinitionCyclesRule.name; // => 'NoDirectiveDefinitionCyclesRule'
 * buildSchema(invalidSDL); // throws an error
 *
 * const validSDL = `
 *   directive @a(arg: String @b) on FIELD_DEFINITION
 *   directive @b on ARGUMENT_DEFINITION
 *   type Query { name: String }
 * `;
 *
 * buildSchema(validSDL); // does not throw
 * ```
 */
export function NoDirectiveDefinitionCyclesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  const schemaDirectives = schema?.getDirectives() ?? [];
  const documentDirectiveNames = new Set<string>();

  for (const definition of context.getDocument().definitions) {
    if (
      definition.kind === Kind.DIRECTIVE_DEFINITION ||
      definition.kind === Kind.DIRECTIVE_EXTENSION
    ) {
      documentDirectiveNames.add(definition.name.value);
    }
  }

  if (
    documentDirectiveNames.size === 0 &&
    !schemaDirectives.some(canSchemaDirectiveDefinitionHaveReferences)
  ) {
    return {};
  }

  const visitedDirectiveCoordinates = new Set<string>();
  const directiveSourceByCoordinate: ObjMap<ReferenceSource> =
    Object.create(null);
  const pathIndexByCoordinate: ObjMap<number | undefined> = Object.create(null);
  const referencePath: Array<Reference> = [];
  const referencesBySourceCoordinate: ObjMap<Array<Reference>> =
    Object.create(null);
  const referenceSourceStack: Array<ReferenceSource | undefined> = [];
  let currentReferenceSource: ReferenceSource | undefined;
  const documentReferenceVisitor = createReferenceVisitor(true);
  const schemaReferenceVisitor = createReferenceVisitor(false);

  if (schema != null) {
    for (const directive of schemaDirectives) {
      collectSchemaDirectiveReferences(directive);
    }

    for (const type of Object.values(schema.getTypeMap())) {
      if (!isInputType(type)) {
        continue;
      }

      const typeSource = {
        coordinate: type.name,
        isFromDocument: false,
      };

      for (const node of [type.astNode, ...type.extensionASTNodes]) {
        if (node != null) {
          visit(node, schemaReferenceVisitor);
        }
      }

      if (isInputObjectType(type)) {
        for (const field of Object.values(type.getFields())) {
          collectSchemaInputValueReferences(
            typeSource,
            field.name,
            field.type,
            field.astNode ?? undefined,
          );
        }
      } else if (isEnumType(type)) {
        for (const value of type.getValues()) {
          collectSchemaEnumValueReferences(
            typeSource,
            value.name,
            value.astNode ?? undefined,
          );
        }
      }
    }
  }

  return {
    ...documentReferenceVisitor,
    Document: {
      leave() {
        for (const source of Object.values(directiveSourceByCoordinate)) {
          detectCycleRecursive(source);
        }
      },
    },
  };

  function createReferenceVisitor(isFromDocument: boolean): ASTVisitor {
    const directiveReferenceSourceVisitor = {
      enter(node: DirectiveDefinitionNode | DirectiveExtensionNode): void {
        enterDirectiveReferenceSource(node.name.value, isFromDocument);
      },
      leave: leaveReferenceSource,
    };
    const typeReferenceSourceVisitor = {
      enter(node: TypeReferenceSourceNode): void {
        enterTypeReferenceSource(node.name.value, isFromDocument);
      },
      leave: leaveReferenceSource,
    };
    const childReferenceSourceVisitor = {
      enter: enterChildReferenceSource,
      leave: leaveReferenceSource,
    };

    return {
      DirectiveDefinition: directiveReferenceSourceVisitor,
      DirectiveExtension: directiveReferenceSourceVisitor,
      ScalarTypeDefinition: typeReferenceSourceVisitor,
      ScalarTypeExtension: typeReferenceSourceVisitor,
      EnumTypeDefinition: typeReferenceSourceVisitor,
      EnumTypeExtension: typeReferenceSourceVisitor,
      InputObjectTypeDefinition: typeReferenceSourceVisitor,
      InputObjectTypeExtension: typeReferenceSourceVisitor,
      EnumValueDefinition: childReferenceSourceVisitor,
      InputValueDefinition: childReferenceSourceVisitor,
      Directive: addReferenceFromCurrentSource,
      NamedType: addReferenceFromCurrentSource,
    };
  }

  function enterDirectiveReferenceSource(
    directiveName: string,
    isFromDocument: boolean,
  ): void {
    pushReferenceSource(
      addDirectiveReferenceSource(directiveName, isFromDocument),
    );
  }

  function addDirectiveReferenceSource(
    directiveName: string,
    isFromDocument: boolean,
  ): ReferenceSource {
    const source = {
      coordinate: '@' + directiveName,
      directiveName,
      isFromDocument,
    };
    directiveSourceByCoordinate[source.coordinate] = source;
    return source;
  }

  function enterTypeReferenceSource(
    typeName: string,
    isFromDocument: boolean,
  ): void {
    pushReferenceSource({ coordinate: typeName, isFromDocument });
  }

  function enterChildReferenceSource(node: ChildReferenceSourceNode): void {
    const parentSource = currentReferenceSource;
    if (parentSource === undefined) {
      referenceSourceStack.push(undefined);
      return;
    }

    const childSource = {
      coordinate: childSourceCoordinate(parentSource, node.name.value),
      isFromDocument: parentSource.isFromDocument,
    };

    addReference(parentSource, referenceFromSource(childSource, node));
    pushReferenceSource(childSource);
  }

  function childSourceCoordinate(
    parentSource: ReferenceSource,
    childName: string,
  ): string {
    return parentSource.directiveName !== undefined
      ? `${parentSource.coordinate}(${childName}:)`
      : `${parentSource.coordinate}.${childName}`;
  }

  function pushReferenceSource(source: ReferenceSource): void {
    referenceSourceStack.push(currentReferenceSource);
    currentReferenceSource = source;
  }

  function leaveReferenceSource(): void {
    currentReferenceSource = referenceSourceStack.pop();
  }

  function addReferenceFromCurrentSource(
    node: DirectiveNode | NamedTypeNode,
  ): void {
    if (
      currentReferenceSource !== undefined &&
      (node.kind !== Kind.DIRECTIVE || shouldRecordDirectiveReference(node))
    ) {
      addReference(
        currentReferenceSource,
        referenceFromNode(node, currentReferenceSource),
      );
    }
  }

  function shouldRecordDirectiveReference(node: DirectiveNode): boolean {
    const directiveName = node.name.value;
    if (documentDirectiveNames.has(directiveName)) {
      return true;
    }

    const existingDirective = schema?.getDirective(directiveName);
    return (
      existingDirective != null && !isSpecifiedDirective(existingDirective)
    );
  }

  function detectCycleRecursive(source: ReferenceSource): void {
    if (source.directiveName !== undefined) {
      if (visitedDirectiveCoordinates.has(source.coordinate)) {
        return;
      }
      visitedDirectiveCoordinates.add(source.coordinate);
    }

    pathIndexByCoordinate[source.coordinate] = referencePath.length;

    for (const reference of referencesBySourceCoordinate[source.coordinate] ??
      []) {
      const cycleIndex = pathIndexByCoordinate[reference.coordinate];

      referencePath.push(reference);
      if (cycleIndex === undefined) {
        detectCycleRecursive(reference);
      } else {
        reportCyclesInPath(cycleIndex, reference);
      }
      referencePath.pop();
    }

    pathIndexByCoordinate[source.coordinate] = undefined;
  }

  function reportCyclesInPath(
    cycleIndex: number,
    repeatedReference: Reference,
  ): void {
    const cyclePath = referencePath.slice(cycleIndex);
    if (!cyclePath.some((cycleReference) => cycleReference.isFromDocument)) {
      return;
    }

    if (repeatedReference.directiveName !== undefined) {
      reportCycle(repeatedReference.directiveName, cyclePath);
      return;
    }

    for (let i = 0; i < cyclePath.length; ++i) {
      const cycleReference = cyclePath[i];
      if (cycleReference.directiveName !== undefined) {
        const directiveCyclePath = cyclePath
          .slice(i + 1)
          .concat(cyclePath.slice(0, i + 1));
        reportCycle(cycleReference.directiveName, directiveCyclePath);
      }
    }
  }

  function addReference(source: ReferenceSource, reference: Reference): void {
    const references = (referencesBySourceCoordinate[source.coordinate] ??= []);
    const existingReferenceIndex = references.findIndex(
      (existingReference) =>
        existingReference.coordinate === reference.coordinate &&
        existingReference.isFromDocument === reference.isFromDocument,
    );

    if (existingReferenceIndex === -1) {
      references.push(reference);
    }
  }

  function referenceFromNode(
    node: DirectiveNode | NamedTypeNode,
    source: ReferenceSource,
  ): Reference {
    const name = node.name.value;
    if (node.kind === Kind.DIRECTIVE) {
      return referenceFromSource(
        {
          coordinate: '@' + name,
          directiveName: name,
          isFromDocument: source.isFromDocument,
        },
        node,
      );
    }

    return referenceFromSource(
      {
        coordinate: name,
        isFromDocument: source.isFromDocument,
      },
      node,
    );
  }

  function referenceFromSource(
    source: ReferenceSource,
    node: ReferenceNode | undefined,
  ): Reference {
    return node === undefined ? source : { ...source, node };
  }

  function collectSchemaDirectiveReferences(directive: GraphQLDirective): void {
    if (isSpecifiedDirective(directive)) {
      return;
    }

    for (const node of [directive.astNode, ...directive.extensionASTNodes]) {
      if (node != null) {
        visit(node, schemaReferenceVisitor);
      }
    }

    const directiveSource = addDirectiveReferenceSource(directive.name, false);

    for (const arg of directive.args) {
      collectSchemaInputValueReferences(
        directiveSource,
        arg.name,
        arg.type,
        arg.astNode ?? undefined,
      );
    }
  }

  function collectSchemaInputValueReferences(
    parentSource: ReferenceSource,
    inputValueName: string,
    type: GraphQLInputType,
    node: InputValueDefinitionNode | undefined,
  ): void {
    if (node != null) {
      visitNodeFromSource(parentSource, node);
    }

    const inputValueSource = {
      coordinate: childSourceCoordinate(parentSource, inputValueName),
      isFromDocument: false,
    };

    addReference(parentSource, referenceFromSource(inputValueSource, node));
    addReference(
      inputValueSource,
      referenceFromSource(
        {
          coordinate: getNamedType(type).name,
          isFromDocument: false,
        },
        undefined,
      ),
    );
  }

  function collectSchemaEnumValueReferences(
    parentSource: ReferenceSource,
    enumValueName: string,
    node: EnumValueDefinitionNode | undefined,
  ): void {
    if (node != null) {
      visitNodeFromSource(parentSource, node);
    }

    const enumValueSource = {
      coordinate: childSourceCoordinate(parentSource, enumValueName),
      isFromDocument: false,
    };

    addReference(parentSource, referenceFromSource(enumValueSource, node));
  }

  function visitNodeFromSource(
    source: ReferenceSource,
    node: InputValueDefinitionNode | EnumValueDefinitionNode,
  ): void {
    pushReferenceSource(source);
    visit(node, schemaReferenceVisitor);
    leaveReferenceSource();
  }

  function reportCycle(
    directiveName: string,
    cyclePath: ReadonlyArray<Reference>,
  ): void {
    const viaPath = cyclePath.map(formatReference).join(', ');

    context.reportError(
      new GraphQLError(
        `Directive "@${directiveName}" forms a reference cycle through: ${viaPath}.`,
        {
          nodes: cyclePath
            .map((reference) => reference.node)
            .filter((node) => node !== undefined),
        },
      ),
    );
  }
}

function formatReference(reference: Reference): string {
  return reference.directiveName !== undefined
    ? `directive application "${reference.coordinate}"`
    : `"${reference.coordinate}"`;
}

function canSchemaDirectiveDefinitionHaveReferences(
  directive: GraphQLDirective,
): boolean {
  return (
    !isSpecifiedDirective(directive) &&
    (directive.astNode != null ||
      directive.extensionASTNodes.length > 0 ||
      directive.args.length > 0)
  );
}
