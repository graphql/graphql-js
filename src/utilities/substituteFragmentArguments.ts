import type { Maybe } from '../jsutils/Maybe.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

import type {
  ArgumentNode,
  FragmentArgumentDefinitionNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  SelectionSetNode,
  ValueNode,
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';
import { visit } from '../language/visitor.js';

/**
 * Replaces all fragment argument values with non-fragment-scoped values.
 *
 * NOTE: fragment arguments are scoped to the fragment they're defined on.
 * Therefore, after we apply the passed-in arguments, all remaining variables
 * must be either operation defined variables or explicitly unset.
 */
export function substituteFragmentArguments(
  def: FragmentDefinitionNode,
  fragmentSpread: FragmentSpreadNode,
): SelectionSetNode {
  const argumentDefinitions = def.arguments;
  if (argumentDefinitions == null || argumentDefinitions.length === 0) {
    return def.selectionSet;
  }
  const argumentValues = fragmentArgumentSubstitutions(
    argumentDefinitions,
    fragmentSpread.arguments,
  );
  return visit(def.selectionSet, {
    Variable(node) {
      return argumentValues[node.name.value];
    },
  });
}

export function fragmentArgumentSubstitutions(
  argumentDefinitions: ReadonlyArray<FragmentArgumentDefinitionNode>,
  argumentValues: Maybe<ReadonlyArray<ArgumentNode>>,
): ObjMap<ValueNode> {
  const substitutions: ObjMap<ValueNode> = {};
  if (argumentValues) {
    for (const argument of argumentValues) {
      substitutions[argument.name.value] = argument.value;
    }
  }

  for (const argumentDefinition of argumentDefinitions) {
    const argumentName = argumentDefinition.variable.name.value;
    if (substitutions[argumentName]) {
      continue;
    }

    const defaultValue = argumentDefinition.defaultValue;
    if (defaultValue) {
      substitutions[argumentName] = defaultValue;
    } else {
      // We need a way to allow unset arguments without accidentally
      // replacing an unset fragment argument with an operation
      // variable value. Fragment arguments must always have LOCAL scope.
      //
      // To remove this hack, we need to either:
      //    - include fragment argument scope when evaluating fields
      //    - make unset fragment arguments invalid
      // Requiring the spread to pass all non-default-defined arguments is nice,
      // but makes field argument default values impossible to use.
      substitutions[argumentName] = {
        kind: Kind.VARIABLE,
        name: { kind: Kind.NAME, value: '__UNSET' },
      };
    }
  }
  return substitutions;
}
