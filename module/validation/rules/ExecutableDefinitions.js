
import { GraphQLError } from '../../error'; /**
                                             * Copyright (c) 2015-present, Facebook, Inc.
                                             *
                                             * This source code is licensed under the MIT license found in the
                                             * LICENSE file in the root directory of this source tree.
                                             *
                                             * 
                                             */

import { FRAGMENT_DEFINITION, OPERATION_DEFINITION, SCHEMA_DEFINITION } from '../../language/kinds';


export function nonExecutableDefinitionMessage(defName) {
  return 'The ' + defName + ' definition is not executable.';
}

/**
 * Executable definitions
 *
 * A GraphQL document is only valid for execution if all definitions are either
 * operation or fragment definitions.
 */
export function ExecutableDefinitions(context) {
  return {
    Document: function Document(node) {
      node.definitions.forEach(function (definition) {
        if (definition.kind !== OPERATION_DEFINITION && definition.kind !== FRAGMENT_DEFINITION) {
          context.reportError(new GraphQLError(nonExecutableDefinitionMessage(definition.kind === SCHEMA_DEFINITION ? 'schema' : definition.name.value), [definition]));
        }
      });
      return false;
    }
  };
}