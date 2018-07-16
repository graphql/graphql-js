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
 * A GraphQL executable tree is only valid if all variables defined by that tree
 * are used, either directly or within a spread fragment.
 *
 * NOTE: if experimentalFragmentVariables are used, then fragments with
 * variables defined are considered an independent "executable tree":
 * fragments defined under them do not count as "within a fragment spread".
 */
export function NoUnusedVariables(context: ValidationContext): ASTVisitor {
  let variableDefs = [];

  const executableDefinitionVisitor = {
    enter(definition: ExecutableDefinitionNode) {
      if (!context.isExecutableDefinitionWithVariables(definition)) {
        return;
      }
      variableDefs = [];
    },
    leave(definition: ExecutableDefinitionNode) {
      if (!context.isExecutableDefinitionWithVariables(definition)) {
        return;
      }

      const variableNameUsed = Object.create(null);
      const usages = context.getRecursiveVariableUsages(definition);
      const opName = definition.name ? definition.name.value : null;

      usages.forEach(({ node }) => {
        variableNameUsed[node.name.value] = true;
      });

      variableDefs.forEach(variableDef => {
        const variableName = variableDef.variable.name.value;
        if (variableNameUsed[variableName] !== true) {
          context.reportError(
            new GraphQLError(unusedVariableMessage(variableName, opName), [
              variableDef,
            ]),
          );
        }
      });
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
