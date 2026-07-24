import { invariant } from '../../../jsutils/invariant.ts';

import type {
  ExecutableDefinitionNode,
  FragmentDefinitionNode,
} from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';

import type { FieldSet } from './FieldSet.ts';
import { sourceFirstStronglyConnectedComponents } from './sourceFirstStronglyConnectedComponents.ts';

type FragmentFieldSets = Array<FieldSet>;

/**
 * Determines which document FieldSets need independent merge proofs. Operation
 * FieldSets and every fragment definition they reach are checked first. Any
 * remaining fragment definitions are checked in dependency order.
 *
 * @internal
 */
export class FieldSetValidationOrder {
  private _operationFieldSets: Array<FieldSet> = [];
  private _fragmentFieldSetsByDefinition = new Map<
    FragmentDefinitionNode,
    FragmentFieldSets
  >();

  getOperationFieldSets(): ReadonlyArray<FieldSet> {
    return this._operationFieldSets;
  }

  getFragmentFieldSets(
    fragmentDefinition: FragmentDefinitionNode,
  ): ReadonlyArray<FieldSet> | undefined {
    return this._fragmentFieldSetsByDefinition.get(fragmentDefinition);
  }

  add(fieldSet: FieldSet, definition: ExecutableDefinitionNode): void {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      this._operationFieldSets.push(fieldSet);
      return;
    }
    if (fieldSet.selectionSet === definition.selectionSet) {
      const fragmentFieldSets = [fieldSet];
      this._fragmentFieldSetsByDefinition.set(definition, fragmentFieldSets);
      return;
    }
    const fragmentFieldSets =
      this._fragmentFieldSetsByDefinition.get(definition);
    invariant(fragmentFieldSets !== undefined);
    fragmentFieldSets.push(fieldSet);
  }

  fragmentFieldSetsToCheck(
    operationReachableFragments: ReadonlySet<FragmentDefinitionNode>,
  ): Iterable<FieldSet> {
    if (
      operationReachableFragments.size ===
      this._fragmentFieldSetsByDefinition.size
    ) {
      return [];
    }
    const fragmentFieldSetsToCheck: Array<FragmentFieldSets> = [];
    const fieldSetsToCheck: Array<FieldSet> = [];
    let hasFragmentDependencies = false;
    for (const [fragmentDefinition, fragmentFieldSets] of this
      ._fragmentFieldSetsByDefinition) {
      if (operationReachableFragments.has(fragmentDefinition)) {
        continue;
      }
      fragmentFieldSetsToCheck.push(fragmentFieldSets);
      for (const fieldSet of fragmentFieldSets) {
        fieldSetsToCheck.push(fieldSet);
        hasFragmentDependencies ||= this._hasFragmentDependencies(fieldSet);
      }
    }

    if (!hasFragmentDependencies) {
      return fieldSetsToCheck;
    }

    const components = sourceFirstStronglyConnectedComponents(
      fragmentFieldSetsToCheck,
      (fragmentFieldSets) => this._dependencies(fragmentFieldSets),
    );
    return this._fieldSetsFromComponents(components);
  }

  private *_fieldSetsFromComponents(
    components: ReadonlyArray<ReadonlyArray<FragmentFieldSets>>,
  ): IterableIterator<FieldSet> {
    for (const component of components) {
      for (const fragmentFieldSets of component) {
        yield* fragmentFieldSets;
      }
    }
  }

  private *_dependencies(
    fragmentFieldSets: FragmentFieldSets,
  ): IterableIterator<FragmentFieldSets> {
    for (const fieldSet of fragmentFieldSets) {
      if (!this._hasFragmentDependencies(fieldSet)) {
        continue;
      }
      for (const spreads of fieldSet.getFragmentSpreadsByName().values()) {
        const dependencyFieldSets = this._fragmentFieldSetsByDefinition.get(
          spreads[0].fragmentDefinition,
        );
        if (dependencyFieldSets !== undefined) {
          yield dependencyFieldSets;
        }
      }
    }
  }

  private _hasFragmentDependencies(fieldSet: FieldSet): boolean {
    return fieldSet.getFragmentSpreadsByName().size !== 0;
  }
}
