
import { GraphQLError } from '../../error'; /**
                                             * Copyright (c) 2015-present, Facebook, Inc.
                                             *
                                             * This source code is licensed under the MIT license found in the
                                             * LICENSE file in the root directory of this source tree.
                                             *
                                             *  strict
                                             */

import suggestionList from '../../jsutils/suggestionList';
import quotedOrList from '../../jsutils/quotedOrList';
import { Kind } from '../../language/kinds';

export function unknownArgMessage(argName, fieldName, typeName, suggestedArgs) {
  var message = 'Unknown argument "' + argName + '" on field "' + fieldName + '" of ' + ('type "' + typeName + '".');
  if (suggestedArgs.length) {
    message += ' Did you mean ' + quotedOrList(suggestedArgs) + '?';
  }
  return message;
}

export function unknownDirectiveArgMessage(argName, directiveName, suggestedArgs) {
  var message = 'Unknown argument "' + argName + '" on directive "@' + directiveName + '".';
  if (suggestedArgs.length) {
    message += ' Did you mean ' + quotedOrList(suggestedArgs) + '?';
  }
  return message;
}

/**
 * Known argument names
 *
 * A GraphQL field is only valid if all supplied arguments are defined by
 * that field.
 */
export function KnownArgumentNames(context) {
  return {
    Argument: function Argument(node, key, parent, path, ancestors) {
      var argDef = context.getArgument();
      if (!argDef) {
        var argumentOf = ancestors[ancestors.length - 1];
        if (argumentOf.kind === Kind.FIELD) {
          var fieldDef = context.getFieldDef();
          var parentType = context.getParentType();
          if (fieldDef && parentType) {
            context.reportError(new GraphQLError(unknownArgMessage(node.name.value, fieldDef.name, parentType.name, suggestionList(node.name.value, fieldDef.args.map(function (arg) {
              return arg.name;
            }))), [node]));
          }
        } else if (argumentOf.kind === Kind.DIRECTIVE) {
          var directive = context.getDirective();
          if (directive) {
            context.reportError(new GraphQLError(unknownDirectiveArgMessage(node.name.value, directive.name, suggestionList(node.name.value, directive.args.map(function (arg) {
              return arg.name;
            }))), [node]));
          }
        }
      }
    }
  };
}