/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { DirectiveNode } from '../../language/ast.ts';
import { OperationTypeNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../../type/directives.ts';

import type { ValidationContext } from '../ValidationContext.ts';

function ifArgumentCanBeFalse(node: DirectiveNode): boolean {
  const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
  if (!ifArgument) {
    return false;
  }
  if (ifArgument.value.kind === Kind.BOOLEAN) {
    if (ifArgument.value.value) {
      return false;
    }
  } else if (ifArgument.value.kind !== Kind.VARIABLE) {
    return false;
  }
  return true;
}

/**
 * Defer And Stream Directives Are Used On Valid Operations
 *
 * A GraphQL document is only valid if defer directives are not used on root mutation or subscription types.
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   validate,
 *   DeferStreamDirectiveOnValidOperationsRule,
 * } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     message: Message
 *   }
 *
 *   type Subscription {
 *     message: Message
 *   }
 *
 *   type Message {
 *     body: String
 *   }
 * `);
 * const invalidDocument = parse(`
 *   subscription {
 *     message {
 *       ...MessageBody @defer
 *     }
 *   }
 *
 *   fragment MessageBody on Message {
 *     body
 *   }
 * `);
 * const validDocument = parse(`
 *   subscription {
 *     message {
 *       ...MessageBody @defer(if: false)
 *     }
 *   }
 *
 *   fragment MessageBody on Message {
 *     body
 *   }
 * `);
 *
 * validate(schema, invalidDocument, [DeferStreamDirectiveOnValidOperationsRule])
 *   .length; // => 1
 * validate(schema, validDocument, [DeferStreamDirectiveOnValidOperationsRule]); // => []
 * ```
 */
export function DeferStreamDirectiveOnValidOperationsRule(
  context: ValidationContext,
): ASTVisitor {
  const fragmentsUsedOnSubscriptions = new Set<string>();

  return {
    OperationDefinition(operation) {
      if (operation.operation === OperationTypeNode.SUBSCRIPTION) {
        for (const fragment of context.getRecursivelyReferencedFragments(
          operation,
        )) {
          fragmentsUsedOnSubscriptions.add(fragment.name.value);
        }
      }
    },
    Directive(node, _key, _parent, _path, ancestors) {
      const definitionNode = ancestors[2];

      if (
        'kind' in definitionNode &&
        ((definitionNode.kind === Kind.FRAGMENT_DEFINITION &&
          fragmentsUsedOnSubscriptions.has(definitionNode.name.value)) ||
          (definitionNode.kind === Kind.OPERATION_DEFINITION &&
            definitionNode.operation === OperationTypeNode.SUBSCRIPTION))
      ) {
        if (node.name.value === GraphQLDeferDirective.name) {
          if (!ifArgumentCanBeFalse(node)) {
            context.reportError(
              new GraphQLError(
                'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
                { nodes: node },
              ),
            );
          }
        } else if (node.name.value === GraphQLStreamDirective.name) {
          if (!ifArgumentCanBeFalse(node)) {
            context.reportError(
              new GraphQLError(
                'Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
                { nodes: node },
              ),
            );
          }
        }
      }
    },
  };
}
