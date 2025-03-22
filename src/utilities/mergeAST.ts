import type { Maybe } from '../jsutils/Maybe';

import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  SelectionNode,
} from '../language/ast';
import { Kind } from '../language/kinds';
import type { ASTVisitor } from '../language/visitor';
import { visit } from '../language/visitor';

import type { GraphQLOutputType } from '../type/definition';
import { getNamedType, isNamedType } from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

import { TypeInfo, visitWithTypeInfo } from './TypeInfo';

export function mergeAST(
  documentAST: DocumentNode,
  schema?: GraphQLSchema | null,
): DocumentNode {
  // If we're given the schema, we can simplify even further by resolving object
  // types vs unions/interfaces
  const typeInfo = schema ? new TypeInfo(schema) : null;

  const fragmentDefinitions: {
    [key: string]: FragmentDefinitionNode | undefined;
  } = Object.create(null);

  for (const definition of documentAST.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragmentDefinitions[definition.name.value] =
        definition;
    }
  }

  const flattenVisitors: ASTVisitor = {
    SelectionSet(node: any) {
      const selectionSetType: Maybe<GraphQLOutputType> =
        typeInfo?.getParentType();
      let { selections } = node;

      selections = selectionSetType
        ? inlineRelevantFragmentSpreads(
            fragmentDefinitions,
            selections,
            selectionSetType,
          )
        : inlineRelevantFragmentSpreads(
            fragmentDefinitions,
            selections,
          );

      return {
        ...node,
        selections,
      };
    },
    FragmentDefinition() {
      return null;
    },
  };

  const flattenedAST = visit(
    documentAST,
    typeInfo
      ? visitWithTypeInfo(typeInfo, flattenVisitors)
      : flattenVisitors,
  );

  const deduplicateVisitors: ASTVisitor = {
    SelectionSet(node: any) {
      let { selections } = node;

      selections = uniqueBy(selections, (selection) =>
        selection.alias
          ? selection.alias.value
          : selection.name.value,
      );

      return {
        ...node,
        selections,
      };
    },
    FragmentDefinition() {
      return null;
    },
  };

  return visit(flattenedAST, deduplicateVisitors);
}

function inlineRelevantFragmentSpreads(
  fragmentDefinitions: {
    [key: string]: FragmentDefinitionNode | undefined;
  },
  selections: ReadonlyArray<SelectionNode>,
  selectionSetType?: GraphQLOutputType,
): ReadonlyArray<SelectionNode> {
  // const selectionSetTypeName = selectionSetType
  //   ? getNamedType(selectionSetType).name
  //   : null;

  let selectionSetTypeName = null;
  if (selectionSetType) {
    const typ = getNamedType(selectionSetType);
    if (isNamedType(typ)) {
      selectionSetTypeName = typ.name;
    }
  }

  const outputSelections = [];
  const seenSpreads: Array<string> = [];
  for (let selection of selections) {
    if (selection.kind === 'FragmentSpread') {
      const fragmentName = selection.name.value;
      if (
        !selection.directives ||
        selection.directives.length === 0
      ) {
        if (seenSpreads.includes(fragmentName)) {
          /* It's a duplicate - skip it! */
          continue;
        } else {
          seenSpreads.push(fragmentName);
        }
      }
      const fragmentDefinition =
        fragmentDefinitions[selection.name.value];
      if (fragmentDefinition) {
        const { typeCondition, directives, selectionSet } =
          fragmentDefinition;
        selection = {
          kind: Kind.INLINE_FRAGMENT,
          typeCondition,
          directives,
          selectionSet,
        };
      }
    }
    if (
      selection.kind === Kind.INLINE_FRAGMENT &&
      // Cannot inline if there are directives
      (!selection.directives ||
        selection.directives?.length === 0)
    ) {
      const fragmentTypeName = selection.typeCondition
        ? selection.typeCondition.name.value
        : null;
      if (
        !fragmentTypeName ||
        fragmentTypeName === selectionSetTypeName
      ) {
        outputSelections.push(
          ...inlineRelevantFragmentSpreads(
            fragmentDefinitions,
            selection.selectionSet.selections,
            selectionSetType,
          ),
        );
        continue;
      }
    }
    outputSelections.push(selection);
  }
  return outputSelections;
}

function uniqueBy<T>(
  array: ReadonlyArray<SelectionNode>,
  iteratee: (item: FieldNode) => T,
) {
  const FilteredMap = new Map<T, FieldNode>();
  const result: Array<SelectionNode> = [];
  for (const item of array) {
    if (item.kind === 'Field') {
      const uniqueValue = iteratee(item);
      const existing = FilteredMap.get(uniqueValue);
      if (item.directives?.length) {
        // Cannot inline fields with directives (yet)
        const itemClone = { ...item };
        result.push(itemClone);
      } else if (
        existing?.selectionSet &&
        item.selectionSet
      ) {
        // Merge the selection sets
        existing.selectionSet.selections = [
          ...existing.selectionSet.selections,
          ...item.selectionSet.selections,
        ];
      } else if (!existing) {
        const itemClone = { ...item };
        FilteredMap.set(uniqueValue, itemClone);
        result.push(itemClone);
      }
    } else {
      result.push(item);
    }
  }
  return result;
}
