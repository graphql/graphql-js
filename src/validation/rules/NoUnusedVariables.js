/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type ValidationContext from '../ValidationContext';
import { GraphQLError } from '../../error';
import { Kind } from '../../language';
import type { ExecutableDefinitionNode } from '../../language';
import type { ASTVisitor } from '../../language/visitor';

export function unusedVariableMessage(
  varName: string,
  opName: ?string,
): string {
  return opName
    ? `Variable "$${varName}" is never used in operation "${opName}".`
    : `Variable "$${varName}" is never used.`;
}

/**
 * No unused variables
 *
 * A GraphQL definition is only valid if all variables defined by that
 * definition are used, either directly or within a spread fragment.
 *
 * NOTE: if experimentalFragmentVariables are used, then fragments with
 * variables defined are considered independent "executable definitions".
 * So `query Foo` must not define `$a` when `$a` is only used inside
 * `fragment FragA($a: Type)`
 */
export function NoUnusedVariables(context: ValidationContext): ASTVisitor {
  let variableDefs = [];

  const executableDefinitionVisitor = {
    enter() {
      variableDefs = [];
    },
    leave(definition: ExecutableDefinitionNode) {
      if (
        definition.kind === Kind.FRAGMENT_DEFINITION &&
        variableDefs.length === 0
      ) {
        return;
      }

      const variableNameUsed = Object.create(null);
      const usages = context.getRecursiveVariableUsages(definition);
      const opName = definition.name ? definition.name.value : null;

      for (const { node } of usages) {
        variableNameUsed[node.name.value] = true;
      }

      for (const variableDef of variableDefs) {
        const variableName = variableDef.variable.name.value;
        if (variableNameUsed[variableName] !== true) {
          context.reportError(
            new GraphQLError(unusedVariableMessage(variableName, opName), [
              variableDef,
            ]),
          );
        }
      }
    },
  };

  return {
    OperationDefinition: executableDefinitionVisitor,
    FragmentDefinition: executableDefinitionVisitor,
    VariableDefinition(def) {
      variableDefs.push(def);
    },
  };
}
