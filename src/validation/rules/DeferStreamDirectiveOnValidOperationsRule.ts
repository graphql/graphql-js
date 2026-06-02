/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DirectiveNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  SelectionSetNode,
} from '../../language/ast.ts';
import { OperationTypeNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import {
  GraphQLDeferDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLStreamDirective,
} from '../../type/directives.ts';

import type { ValidationContext } from '../ValidationContext.ts';

function ifArgumentCanBeFalse(node: DirectiveNode): boolean {
  // @defer(if: false) / @stream(if: false)
  // @defer(if: $shouldDefer) / @stream(if: $shouldStream)
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

function canBeSkippedViaSkipDirective(node: DirectiveNode): boolean {
  // @skip(if: true)
  // @skip(if: $shouldSkip)
  const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
  if (!ifArgument) {
    // Missing `if` is reported by ProvidedRequiredArgumentsRule. For this rule,
    // treat malformed @skip as potentially skipped to avoid duplicate errors.
    return true;
  }

  if (ifArgument.value.kind === Kind.BOOLEAN) {
    // If argument is a Static boolean
    if (ifArgument.value.value) {
      // always skipped
      return true;
    }
    // Never skipped
    return false;
  }

  // Can be skipped via variable
  return true;
}

function canBeSkippedViaIncludeDirective(node: DirectiveNode): boolean {
  // @include(if: false)
  // @include(if: $shouldInclude)
  const ifArgument = node.arguments?.find((arg) => arg.name.value === 'if');
  if (!ifArgument) {
    // Missing `if` is reported by ProvidedRequiredArgumentsRule. For this rule,
    // treat malformed @include as not skippable.
    return false;
  }
  if (ifArgument?.value.kind === Kind.BOOLEAN) {
    // If argument is a Static boolean
    if (ifArgument.value.value) {
      // Never skipped
      return false;
    }
    // Always skipped
    return true;
  }

  // Can be skipped via variable
  return true;
}

/**
 * Defer And Stream Directives Are Used On Valid Operations
 *
 * A GraphQL document is only valid if defer and stream directives are not used on root mutation or subscription types.
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
  return {
    OperationDefinition(operation) {
      if (operation.operation !== OperationTypeNode.SUBSCRIPTION) {
        return;
      }
      const document = context.getDocument();
      const fragments = new Map<string, FragmentDefinitionNode>();

      for (const definition of document.definitions) {
        if (definition.kind === Kind.FRAGMENT_DEFINITION) {
          fragments.set(definition.name.value, definition);
        }
      }
      const visitedFragments = new Set<string>();
      forbidUnconditionalDeferStream({
        context,
        fragments,
        selectionSet: operation.selectionSet,
        parentNodes: [],
        visitedFragments,
      });
    },
  };
}

function forbidUnconditionalDeferStream({
  context,
  fragments,
  selectionSet,
  parentNodes,
  visitedFragments,
}: {
  context: ValidationContext;
  fragments: Map<string, FragmentDefinitionNode>;
  selectionSet: SelectionSetNode;
  parentNodes: Array<FragmentSpreadNode>;
  visitedFragments: Set<string>;
}) {
  for (const selection of selectionSet.selections) {
    const skip = selection.directives?.find(
      (d) => d.name.value === GraphQLSkipDirective.name,
    );
    if (skip && canBeSkippedViaSkipDirective(skip)) {
      continue;
    }
    const include = selection.directives?.find(
      (d) => d.name.value === GraphQLIncludeDirective.name,
    );
    if (include && canBeSkippedViaIncludeDirective(include)) {
      continue;
    }
    for (const directive of selection.directives ?? []) {
      if (directive.name.value === GraphQLDeferDirective.name) {
        if (!ifArgumentCanBeFalse(directive)) {
          context.reportError(
            new GraphQLError(
              'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
              { nodes: [directive, ...parentNodes] },
            ),
          );
        }
      } else if (directive.name.value === GraphQLStreamDirective.name) {
        if (!ifArgumentCanBeFalse(directive)) {
          context.reportError(
            new GraphQLError(
              'Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
              { nodes: [directive, ...parentNodes] },
            ),
          );
        }
      }
    }
    if (selection.kind === 'FragmentSpread') {
      const fragmentName = selection.name.value;
      if (visitedFragments.has(fragmentName)) {
        continue;
      }
      visitedFragments.add(fragmentName);
      const fragment = fragments.get(fragmentName);
      if (fragment) {
        forbidUnconditionalDeferStream({
          context,
          fragments,
          parentNodes: [selection, ...parentNodes],
          selectionSet: fragment?.selectionSet,
          visitedFragments,
        });
      }
    } else if (selection.selectionSet) {
      forbidUnconditionalDeferStream({
        context,
        fragments,
        selectionSet: selection.selectionSet,
        parentNodes,
        visitedFragments,
      });
    }
  }
}

// - For each {selection} in {selectionSet}:
//   - If {selection} provides the `@skip` directive, and the "if" argument on that
//     directive is not the boolean value {true}:
//     - Continue to the next {selection} in {selectionSet}.
//   - If {selection} provides the `@include` directive, and the "if" argument on
//     that directive is not the boolean value {false}:
//     - Continue to the next {selection} in {selectionSet}.
//   - For each {directive} on {selection}:
//     - If {directive} is `@defer` or `@stream`:
//       - Let {if} be the argument named "if" on {directive}.
//       - {if} must be defined.
//       - Let {argumentValue} be the value passed to {if}.
//       - {argumentValue} must be a variable, or the boolean value "false".
//   - If {selection} is a {FragmentSpread}:
//     - Let {fragmentSpreadName} be the name of {selection}.
//     - If {fragmentSpreadName} is in {visitedFragments}, continue with the next
//       {selection} in {selectionSet}.
//     - Add {fragmentSpreadName} to {visitedFragments}.
//     - Let {fragment} be the Fragment in the current Document whose name is
//       {fragmentSpreadName}.
//     - Let {fragmentSelectionSet} be the selection set of {selection}.
//     - {ForbidUnconditionalDeferStream(fragmentSelectionSet)}
//   - If {selection} is an {InlineFragment}:
//     - Let {fragmentSelectionSet} be the selection set of {selection}.
//     - {ForbidUnconditionalDeferStream(fragmentSelectionSet)}
//   - If {selection} is a {Field}:
//     - Let {fieldSelectionSet} be the selection set of {selection}.
//     - {ForbidUnconditionalDeferStream(fieldSelectionSet)}
