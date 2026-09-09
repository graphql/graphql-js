/** @category Validation Rules */

import type {
  ASTNode,
  DefinitionNode,
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
  TypeNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLSchemaElement,
} from '../../type/definition.ts';
import {
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInputType,
} from '../../type/definition.ts';
import type { GraphQLDirective } from '../../type/directives.ts';
import { isDirective, specifiedDirectives } from '../../type/directives.ts';
import type { GraphQLSchema } from '../../type/schema.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

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
  readonly node?: ASTNode;
}

interface SchemaElementDirectiveNodes {
  readonly astNode?:
    | { readonly directives?: ReadonlyArray<DirectiveNode> | undefined }
    | null
    | undefined;
  readonly extensionASTNodes?:
    | ReadonlyArray<{
        readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
      }>
    | undefined;
}
type SchemaInputValueElement = GraphQLSchemaElement & {
  readonly name: string;
  readonly type: unknown;
  readonly astNode?: InputValueDefinitionNode | null | undefined;
};

/**
 * Directive definitions must not form reference cycles through directives or
 * directive argument input types.
 *
 * See https://spec.graphql.org/draft/#sec-Type-System.Directives
 * @category Validation Rules
 
 * @internal
 */
export const NoDirectiveDefinitionCyclesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    const schema = index.schema;
    if (schema != null && index.shouldValidateSchemaOnlyElements()) {
      if (!canSkipSchemaDirectiveDefinitionCycleCheck(schema)) {
        const graph = new DirectiveDefinitionReferenceGraph(false);
        collectSchemaDirectiveDefinitionReferences(schema, graph, false);
        graph.detectCycles((directiveName, cyclePath) => {
          index.reportError(
            directiveDefinitionCycleErrorMessage(directiveName, cyclePath),
            cyclePath
              .map((reference) => reference.node)
              .filter((node) => node != null),
          );
        });
      }
    }

    const document = index.document;
    if (!hasDirectiveCycleRelevantDocumentNodes(document)) {
      return;
    }

    const graph = new DirectiveDefinitionReferenceGraph(true);
    if (schema != null) {
      collectSchemaDirectiveDefinitionReferences(schema, graph, false);
    }

    graph.collectDocumentDefinitionReferences(document.definitions, true);
    graph.detectCycles((directiveName, cyclePath) => {
      index.reportError(
        directiveDefinitionCycleErrorMessage(directiveName, cyclePath),
        cyclePath
          .map((reference) => reference.node)
          .filter((node) => node != null),
      );
    });
  };

function canSkipSchemaDirectiveDefinitionCycleCheck(
  schema: GraphQLSchema,
): boolean {
  const directives = schema.getDirectives();
  if (directives === specifiedDirectives) {
    return true;
  }

  for (const directive of directives) {
    if (!isDirective(directive) || !specifiedDirectives.includes(directive)) {
      return false;
    }

    if (getSchemaElementDirectiveNodes(directive) !== undefined) {
      return false;
    }

    for (const arg of directive.args) {
      if (getSchemaElementDirectiveNodes(arg) !== undefined) {
        return false;
      }
    }
  }

  return true;
}

function hasDirectiveCycleRelevantDocumentNodes(documentNode: {
  readonly definitions: ReadonlyArray<DefinitionNode>;
}): boolean {
  for (const definition of documentNode.definitions) {
    switch (definition.kind) {
      case Kind.DIRECTIVE_DEFINITION:
      case Kind.DIRECTIVE_EXTENSION:
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION:
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION:
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
        return true;
      default:
        break;
    }
  }
  return false;
}

class DirectiveDefinitionReferenceGraph {
  private _requireDocumentReference: boolean;
  private _directiveSourceByCoordinate = new Map<string, ReferenceSource>();
  private _referencesBySourceCoordinate = new Map<string, Array<Reference>>();
  private _visitedDirectiveCoordinates = new Set<string>();
  private _pathIndexByCoordinate = new Map<string, number>();
  private _referencePath = new Array<Reference>();

  constructor(requireDocumentReference: boolean) {
    this._requireDocumentReference = requireDocumentReference;
  }

  collectDocumentDefinitionReferences(
    definitions: ReadonlyArray<DefinitionNode>,
    isFromDocument: boolean,
  ): void {
    for (const definition of definitions) {
      switch (definition.kind) {
        case Kind.DIRECTIVE_DEFINITION:
        case Kind.DIRECTIVE_EXTENSION:
          this.collectDirectiveReferenceSource(definition, isFromDocument);
          break;
        case Kind.SCALAR_TYPE_DEFINITION:
        case Kind.SCALAR_TYPE_EXTENSION:
        case Kind.ENUM_TYPE_DEFINITION:
        case Kind.ENUM_TYPE_EXTENSION:
        case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        case Kind.INPUT_OBJECT_TYPE_EXTENSION:
          this.collectTypeReferenceSource(definition, isFromDocument);
          break;
        default:
          break;
      }
    }
  }

  addDirectiveReferenceSource(
    directiveName: string,
    isFromDocument: boolean,
  ): ReferenceSource {
    const source = {
      coordinate: `@${directiveName}`,
      directiveName,
      isFromDocument,
    };
    this._directiveSourceByCoordinate.set(source.coordinate, source);
    return source;
  }

  addReference(source: ReferenceSource, reference: Reference): void {
    let references = this._referencesBySourceCoordinate.get(source.coordinate);
    if (references == null) {
      references = [];
      this._referencesBySourceCoordinate.set(source.coordinate, references);
    }

    if (
      references.some(
        (existingReference) =>
          existingReference.coordinate === reference.coordinate &&
          existingReference.isFromDocument === reference.isFromDocument,
      )
    ) {
      return;
    }

    references.push(reference);
  }

  addDirectiveUsageReferences(
    source: ReferenceSource,
    directives: ReadonlyArray<{ readonly name: string }> | undefined,
  ): void {
    if (directives == null) {
      return;
    }
    for (const directive of directives) {
      this.addReference(
        source,
        this.referenceFromSource({
          coordinate: `@${directive.name}`,
          directiveName: directive.name,
          isFromDocument: source.isFromDocument,
        }),
      );
    }
  }

  addDirectiveUsageNodeReferences(
    source: ReferenceSource,
    directives: ReadonlyArray<DirectiveNode> | undefined,
  ): void {
    if (directives == null) {
      return;
    }

    for (const directive of directives) {
      this.addReference(
        source,
        this.referenceFromSource(
          {
            coordinate: `@${directive.name.value}`,
            directiveName: directive.name.value,
            isFromDocument: source.isFromDocument,
          },
          directive,
        ),
      );
    }
  }

  referenceFromSource(
    source: ReferenceSource,
    node?: ReferenceNode,
  ): Reference {
    return node === undefined ? source : { ...source, node };
  }

  detectCycles(
    onCycle: (
      directiveName: string,
      cyclePath: ReadonlyArray<Reference>,
    ) => void,
  ): void {
    for (const source of this._directiveSourceByCoordinate.values()) {
      this.detectCycleRecursive(source, onCycle);
    }
  }

  private addTypeNodeReference(source: ReferenceSource, typeNode: TypeNode) {
    const namedTypeNode = getNamedTypeNode(typeNode);
    this.addReference(
      source,
      this.referenceFromSource(
        {
          coordinate: namedTypeNode.name.value,
          isFromDocument: source.isFromDocument,
        },
        namedTypeNode,
      ),
    );
  }

  private collectDirectiveReferenceSource(
    node: DirectiveDefinitionNode | DirectiveExtensionNode,
    isFromDocument: boolean,
  ): void {
    const source = this.addDirectiveReferenceSource(
      node.name.value,
      isFromDocument,
    );
    this.addDirectiveUsageNodeReferences(source, node.directives);

    if (node.kind === Kind.DIRECTIVE_DEFINITION) {
      const args = node.arguments;
      if (args == null) {
        return;
      }
      for (const arg of args) {
        this.addChildReferenceSource(source, arg);
      }
    }
  }

  private collectTypeReferenceSource(
    node: TypeReferenceSourceNode,
    isFromDocument: boolean,
  ): void {
    const source = {
      coordinate: node.name.value,
      isFromDocument,
    };
    this.addDirectiveUsageNodeReferences(source, node.directives);

    switch (node.kind) {
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION: {
        const values = node.values;
        if (values == null) {
          break;
        }
        for (const value of values) {
          this.addChildReferenceSource(source, value);
        }
        break;
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
        const fields = node.fields;
        if (fields == null) {
          break;
        }
        for (const field of fields) {
          this.addChildReferenceSource(source, field);
        }
        break;
      }
      default:
        break;
    }
  }

  private addChildReferenceSource(
    parentSource: ReferenceSource,
    node: ChildReferenceSourceNode,
  ): void {
    const childSource = {
      coordinate: childSourceCoordinate(parentSource, node.name.value),
      isFromDocument: parentSource.isFromDocument,
    };

    this.addReference(
      parentSource,
      this.referenceFromSource(childSource, node),
    );
    this.addDirectiveUsageNodeReferences(childSource, node.directives);
    if (node.kind === Kind.INPUT_VALUE_DEFINITION) {
      this.addTypeNodeReference(childSource, node.type);
    }
  }

  private detectCycleRecursive(
    source: ReferenceSource,
    onCycle: (
      directiveName: string,
      cyclePath: ReadonlyArray<Reference>,
    ) => void,
  ): void {
    if (source.directiveName !== undefined) {
      if (this._visitedDirectiveCoordinates.has(source.coordinate)) {
        return;
      }
      this._visitedDirectiveCoordinates.add(source.coordinate);
    }

    this._pathIndexByCoordinate.set(
      source.coordinate,
      this._referencePath.length,
    );

    const references = this._referencesBySourceCoordinate.get(
      source.coordinate,
    );
    if (references != null) {
      for (const reference of references) {
        const cycleIndex = this._pathIndexByCoordinate.get(
          reference.coordinate,
        );

        this._referencePath.push(reference);
        if (cycleIndex === undefined) {
          this.detectCycleRecursive(reference, onCycle);
        } else {
          this.reportCyclesInPath(cycleIndex, reference, onCycle);
        }
        this._referencePath.pop();
      }
    }

    this._pathIndexByCoordinate.delete(source.coordinate);
  }

  private reportCyclesInPath(
    cycleIndex: number,
    repeatedReference: Reference,
    onCycle: (
      directiveName: string,
      cyclePath: ReadonlyArray<Reference>,
    ) => void,
  ): void {
    const cyclePath = this._referencePath.slice(cycleIndex);
    if (
      this._requireDocumentReference &&
      !cyclePath.some((cycleReference) => cycleReference.isFromDocument)
    ) {
      return;
    }

    if (repeatedReference.directiveName !== undefined) {
      onCycle(repeatedReference.directiveName, cyclePath);
      return;
    }

    for (let i = 0; i < cyclePath.length; ++i) {
      const cycleReference = cyclePath[i];
      if (cycleReference.directiveName !== undefined) {
        onCycle(
          cycleReference.directiveName,
          cyclePath.slice(i + 1).concat(cyclePath.slice(0, i + 1)),
        );
      }
    }
  }
}

function collectSchemaDirectiveDefinitionReferences(
  schema: GraphQLSchema,
  graph: DirectiveDefinitionReferenceGraph,
  isFromDocument: boolean,
): void {
  const directiveDefinitions = getSchemaDirectiveDefinitions(schema);
  const visitedInputTypeNames = new Set<string>();

  function collectReachableInputType(type: unknown): void {
    if (!isInputType(type)) {
      return;
    }

    const namedType = getNamedType(type);
    if (!isInputType(namedType) || visitedInputTypeNames.has(namedType.name)) {
      return;
    }

    visitedInputTypeNames.add(namedType.name);

    const typeSource = {
      coordinate: namedType.name,
      isFromDocument,
    };
    addSchemaDirectiveUsageReferences(graph, typeSource, namedType);

    if (isInputObjectType(namedType)) {
      collectSchemaInputObjectReferences(
        namedType,
        graph,
        typeSource,
        collectReachableInputType,
      );
    } else if (isEnumType(namedType)) {
      collectSchemaEnumReferences(namedType, graph, typeSource);
    }
  }

  for (const directive of directiveDefinitions) {
    if (isDirective(directive)) {
      collectSchemaDirectiveReferences(
        directive,
        graph,
        isFromDocument,
        collectReachableInputType,
      );
    }
  }
}

function collectSchemaDirectiveReferences(
  directive: GraphQLDirective,
  graph: DirectiveDefinitionReferenceGraph,
  isFromDocument: boolean,
  collectReachableInputType: (type: unknown) => void,
): void {
  const directiveSource = graph.addDirectiveReferenceSource(
    directive.name,
    isFromDocument,
  );
  addSchemaDirectiveUsageReferences(graph, directiveSource, directive);

  for (const arg of directive.args) {
    collectSchemaInputValueReferences(graph, directiveSource, arg);
    collectReachableInputType(arg.type);
  }
}

function collectSchemaInputObjectReferences(
  type: GraphQLInputObjectType,
  graph: DirectiveDefinitionReferenceGraph,
  typeSource: ReferenceSource,
  collectReachableInputType: (type: unknown) => void,
): void {
  for (const field of Object.values(type.getFields())) {
    collectSchemaInputValueReferences(graph, typeSource, field);
    collectReachableInputType(field.type);
  }
}

function collectSchemaEnumReferences(
  type: GraphQLEnumType,
  graph: DirectiveDefinitionReferenceGraph,
  typeSource: ReferenceSource,
): void {
  for (const value of type.getValues()) {
    const valueSource = {
      coordinate: childSourceCoordinate(typeSource, value.name),
      isFromDocument: typeSource.isFromDocument,
    };
    graph.addReference(
      typeSource,
      graph.referenceFromSource(valueSource, value.astNode ?? undefined),
    );
    addSchemaDirectiveUsageReferences(graph, valueSource, value);
  }
}

function addSchemaDirectiveUsageReferences(
  graph: DirectiveDefinitionReferenceGraph,
  source: ReferenceSource,
  element: GraphQLSchema | GraphQLSchemaElement,
): void {
  graph.addDirectiveUsageNodeReferences(
    source,
    getSchemaElementDirectiveNodes(element),
  );
  graph.addDirectiveUsageReferences(
    source,
    getSchemaDirectiveUsageNames(element),
  );
}

function getSchemaElementDirectiveNodes(
  element: GraphQLSchema | GraphQLSchemaElement,
): ReadonlyArray<DirectiveNode> | undefined {
  const elementWithNodes = element as SchemaElementDirectiveNodes;
  let directiveNodes: Array<DirectiveNode> | undefined;

  const astNode = elementWithNodes.astNode;
  if (astNode?.directives != null) {
    directiveNodes = [...astNode.directives];
  }

  const extensionASTNodes = elementWithNodes.extensionASTNodes;
  if (extensionASTNodes != null) {
    for (const extensionASTNode of extensionASTNodes) {
      if (extensionASTNode.directives != null) {
        directiveNodes ??= [];
        directiveNodes.push(...extensionASTNode.directives);
      }
    }
  }

  return directiveNodes;
}

function getSchemaDirectiveUsageNames(
  element: GraphQLSchema | GraphQLSchemaElement,
): ReadonlyArray<{ readonly name: string }> | undefined {
  let names: Array<{ readonly name: string }> | undefined;

  if ('deprecationReason' in element && element.deprecationReason != null) {
    (names ??= []).push({ name: 'deprecated' });
  }
  if ('specifiedByURL' in element && element.specifiedByURL != null) {
    (names ??= []).push({ name: 'specifiedBy' });
  }
  if ('isOneOf' in element && element.isOneOf === true) {
    (names ??= []).push({ name: 'oneOf' });
  }

  return names;
}

function getSchemaDirectiveDefinitions(
  schema: GraphQLSchema,
): ReadonlyArray<GraphQLDirective> {
  return schema.getDirectives().filter(isDirective);
}

function collectSchemaInputValueReferences(
  graph: DirectiveDefinitionReferenceGraph,
  parentSource: ReferenceSource,
  inputValue: SchemaInputValueElement,
): void {
  const inputValueSource = {
    coordinate: childSourceCoordinate(parentSource, inputValue.name),
    isFromDocument: parentSource.isFromDocument,
  };

  graph.addReference(
    parentSource,
    graph.referenceFromSource(
      inputValueSource,
      inputValue.astNode ?? undefined,
    ),
  );
  if (isInputType(inputValue.type)) {
    graph.addReference(
      inputValueSource,
      graph.referenceFromSource({
        coordinate: getNamedType(inputValue.type).name,
        isFromDocument: parentSource.isFromDocument,
      }),
    );
  }
  addSchemaDirectiveUsageReferences(graph, inputValueSource, inputValue);
}

function getNamedTypeNode(typeNode: TypeNode): NamedTypeNode {
  return typeNode.kind === Kind.NAMED_TYPE
    ? typeNode
    : getNamedTypeNode(typeNode.type);
}

function childSourceCoordinate(
  parentSource: ReferenceSource,
  childName: string,
): string {
  return parentSource.directiveName !== undefined
    ? `${parentSource.coordinate}(${childName}:)`
    : `${parentSource.coordinate}.${childName}`;
}

function directiveDefinitionCycleErrorMessage(
  directiveName: string,
  cyclePath: ReadonlyArray<Reference>,
): string {
  return `Directive "@${directiveName}" forms a reference cycle through: ${cyclePath
    .map(formatReference)
    .join(', ')}.`;
}

function formatReference(reference: Reference): string {
  return reference.directiveName !== undefined
    ? `directive application "${reference.coordinate}"`
    : `"${reference.coordinate}"`;
}
