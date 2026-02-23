import type {
  DocumentNode,
  DefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
} from '../language/ast';
import { Kind } from '../language/kinds';
import { print } from '../language/printer';

/**
 * Provided a collection of ASTs, merge their definitions together,
 * combining selection sets of operations with the same name and type.
 *
 * This is useful for dynamically constructing queries by merging
 * selections from multiple sources, such as when building queries
 * that need to include fields required by resolvers.
 *
 * Fields are considered identical when they have the same response name
 * (alias or field name) and the same arguments. When two identical fields
 * both have selection sets, their selections are recursively merged.
 *
 * Fragment definitions with the same name are deduplicated (the first
 * occurrence is kept).
 *
 * Operations are matched by name and operation type (query/mutation/subscription).
 * Unnamed operations are matched by operation type alone.
 */
export function mergeAST(
  documents: ReadonlyArray<DocumentNode>,
): DocumentNode {
  const operationMap = new Map<string, OperationDefinitionNode>();
  const fragmentMap = new Map<string, FragmentDefinitionNode>();
  const otherDefinitions: DefinitionNode[] = [];

  for (const doc of documents) {
    for (const definition of doc.definitions) {
      if (definition.kind === Kind.OPERATION_DEFINITION) {
        const key = operationKey(definition);
        const existing = operationMap.get(key);
        if (existing) {
          operationMap.set(key, mergeOperations(existing, definition));
        } else {
          operationMap.set(key, definition);
        }
      } else if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        const name = definition.name.value;
        if (!fragmentMap.has(name)) {
          fragmentMap.set(name, definition);
        }
      } else {
        otherDefinitions.push(definition);
      }
    }
  }

  const definitions: Array<DefinitionNode> = [
    ...operationMap.values(),
    ...fragmentMap.values(),
    ...otherDefinitions,
  ];

  return { kind: Kind.DOCUMENT, definitions };
}

/**
 * Generate a unique key for an operation based on its type and name.
 */
function operationKey(operation: OperationDefinitionNode): string {
  const name = operation.name?.value ?? '';
  return `${operation.operation}:${name}`;
}

/**
 * Merge two operations by combining their selection sets and variable definitions.
 */
function mergeOperations(
  a: OperationDefinitionNode,
  b: OperationDefinitionNode,
): OperationDefinitionNode {
  const mergedSelectionSet = mergeSelectionSets(
    a.selectionSet,
    b.selectionSet,
  );
  const mergedVariableDefinitions = mergeVariableDefinitions(
    a.variableDefinitions ?? [],
    b.variableDefinitions ?? [],
  );
  const mergedDirectives = mergeDirectives(
    a.directives ?? [],
    b.directives ?? [],
  );

  return {
    ...a,
    selectionSet: mergedSelectionSet,
    ...(mergedVariableDefinitions.length > 0
      ? { variableDefinitions: mergedVariableDefinitions }
      : {}),
    ...(mergedDirectives.length > 0 ? { directives: mergedDirectives } : {}),
  };
}

/**
 * Merge two selection sets by combining their selections and deduplicating
 * fields with the same response name and arguments.
 */
function mergeSelectionSets(
  a: SelectionSetNode,
  b: SelectionSetNode,
): SelectionSetNode {
  const merged = mergeSelections([...a.selections, ...b.selections]);
  return {
    kind: Kind.SELECTION_SET,
    selections: merged,
  };
}

/**
 * Merge an array of selections, deduplicating fields that have the same
 * response name and arguments by recursively merging their selection sets.
 */
function mergeSelections(
  selections: ReadonlyArray<SelectionNode>,
): ReadonlyArray<SelectionNode> {
  const fieldMap = new Map<string, FieldNode>();
  const inlineFragmentMap = new Map<string, InlineFragmentNode>();
  const result: SelectionNode[] = [];

  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      const key = fieldKey(selection);
      const existing = fieldMap.get(key);
      if (existing) {
        fieldMap.set(key, mergeFieldNodes(existing, selection));
        // Update the entry in result array
        const idx = result.indexOf(existing);
        result[idx] = fieldMap.get(key)!;
      } else {
        fieldMap.set(key, selection);
        result.push(selection);
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      const key = inlineFragmentKey(selection);
      const existing = inlineFragmentMap.get(key);
      if (existing) {
        const merged = mergeInlineFragments(existing, selection);
        inlineFragmentMap.set(key, merged);
        const idx = result.indexOf(existing);
        result[idx] = merged;
      } else {
        inlineFragmentMap.set(key, selection);
        result.push(selection);
      }
    } else {
      // FragmentSpread - deduplicate by name and directives
      const key = print(selection);
      if (!result.some((s) => s.kind === Kind.FRAGMENT_SPREAD && print(s) === key)) {
        result.push(selection);
      }
    }
  }

  return result;
}

/**
 * Generate a key for a field based on its response name (alias or field name)
 * and its arguments, so that fields with different arguments are not merged.
 */
function fieldKey(field: FieldNode): string {
  const responseName = field.alias?.value ?? field.name.value;
  const args = field.arguments?.length
    ? '(' +
      field.arguments
        .map((arg) => `${arg.name.value}: ${print(arg.value)}`)
        .sort()
        .join(', ') +
      ')'
    : '';
  return `${responseName}${args}`;
}

/**
 * Generate a key for an inline fragment based on its type condition and directives.
 */
function inlineFragmentKey(fragment: InlineFragmentNode): string {
  const typeName = fragment.typeCondition?.name.value ?? '';
  const directives = fragment.directives?.length
    ? fragment.directives.map((d) => print(d)).sort().join(' ')
    : '';
  return `${typeName}:${directives}`;
}

/**
 * Merge two field nodes. If both have selection sets, recursively merge them.
 * If only one has a selection set, use that one. Directives are combined.
 */
function mergeFieldNodes(a: FieldNode, b: FieldNode): FieldNode {
  if (a.selectionSet && b.selectionSet) {
    const mergedDirectives = mergeDirectives(
      a.directives ?? [],
      b.directives ?? [],
    );
    return {
      ...a,
      selectionSet: mergeSelectionSets(a.selectionSet, b.selectionSet),
      ...(mergedDirectives.length > 0
        ? { directives: mergedDirectives }
        : {}),
    };
  }

  if (b.selectionSet) {
    return { ...b };
  }

  return { ...a };
}

/**
 * Merge two inline fragments with the same type condition by merging
 * their selection sets.
 */
function mergeInlineFragments(
  a: InlineFragmentNode,
  b: InlineFragmentNode,
): InlineFragmentNode {
  return {
    ...a,
    selectionSet: mergeSelectionSets(a.selectionSet, b.selectionSet),
  };
}

/**
 * Merge variable definitions, deduplicating by variable name.
 * The first occurrence of each variable is kept.
 */
function mergeVariableDefinitions(
  a: ReadonlyArray<{ readonly variable: { readonly name: { readonly value: string } } }>,
  b: ReadonlyArray<{ readonly variable: { readonly name: { readonly value: string } } }>,
): ReadonlyArray<typeof a[number]> {
  const seen = new Set<string>();
  const result: Array<typeof a[number]> = [];
  for (const varDef of [...a, ...b]) {
    const name = varDef.variable.name.value;
    if (!seen.has(name)) {
      seen.add(name);
      result.push(varDef);
    }
  }
  return result;
}

/**
 * Merge directive arrays, deduplicating by their printed representation.
 */
function mergeDirectives<
  T extends { readonly kind: string },
>(
  a: ReadonlyArray<T>,
  b: ReadonlyArray<T>,
): ReadonlyArray<T> {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const directive of [...a, ...b]) {
    const key = print(directive as unknown as Parameters<typeof print>[0]);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(directive);
    }
  }
  return result;
}
