/** @category Validation Rules */

import { inspect } from '../../jsutils/inspect.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DirectiveNode,
  FieldNode,
  FragmentSpreadNode,
  InputValueDefinitionNode,
  VariableDefinitionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { print } from '../../language/printer.ts';

import type { GraphQLArgument } from '../../type/definition.ts';
import {
  isInputType,
  isRequiredArgument as isRequiredGraphQLArgument,
} from '../../type/definition.ts';

import type {
  ArgumentReference,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Required field, fragment, and directive arguments must be provided.
 *
 * See https://spec.graphql.org/draft/#sec-Required-Arguments
 * @category Validation Rules
 
 * @internal
 */
export const ProvidedRequiredArgumentsASTVisitor: ASTVisitorFn = (context) => {
  const { index, indexCursor } = context;

  return {
    Directive: validateDirective,
    Field: {
      leave(fieldNode) {
        validateFieldArguments(fieldNode);
      },
    },
    FragmentSpread: {
      leave(spreadNode) {
        validateFragmentArguments(spreadNode);
      },
    },
  };

  function validateFieldArguments(fieldNode: FieldNode): void {
    const fieldDef = indexCursor.getCurrentFieldDef();
    if (fieldDef == null) {
      return;
    }

    const fieldArgs = index.getFieldArguments(fieldDef);
    if (fieldArgs == null) {
      return;
    }

    const parentType = indexCursor.getCurrentParentType();
    let providedArgs: Set<string> | undefined;
    for (const argDef of fieldArgs) {
      if (isGraphQLArgument(argDef)) {
        if (!isRequiredGraphQLArgument(argDef)) {
          continue;
        }

        providedArgs ??= getProvidedArgs(fieldNode.arguments);
        if (providedArgs?.has(argDef.name) === true) {
          continue;
        }

        context.reportError(
          new GraphQLError(
            `Argument "${argDef}" of type "${argDef.type}" is required, but it was not provided.`,
            { nodes: fieldNode },
          ),
        );
        continue;
      }

      if (!index.isRequiredArgument(argDef)) {
        continue;
      }

      const argName = index.getArgumentName(argDef);
      providedArgs ??= getProvidedArgs(fieldNode.arguments);
      if (providedArgs?.has(argName) === true) {
        continue;
      }

      const argType = index.getArgumentType(argDef);
      if (argType == null) {
        continue;
      }

      context.reportError(
        new GraphQLError(
          `Argument "${index.argumentToString(
            argDef,
            fieldDef,
            parentType,
          )}" of type "${index.typeToString(
            argType,
          )}" is required, but it was not provided.`,
          { nodes: fieldNode },
        ),
      );
    }
  }

  function validateFragmentArguments(spreadNode: FragmentSpreadNode): void {
    const fragmentSignature =
      indexCursor.getCurrentFragmentSignature() ??
      context.documentIndex.getFragmentSignatureByName()(spreadNode.name.value);
    if (fragmentSignature == null) {
      return;
    }

    const providedArgs = getProvidedArgs(spreadNode.arguments);
    for (const [
      varName,
      variableDefinition,
    ] of fragmentSignature.variableDefinitions) {
      if (
        providedArgs?.has(varName) !== true &&
        isRequiredVariableDefinitionNode(variableDefinition)
      ) {
        const argType =
          index.getInputTypeReference(variableDefinition.type) ??
          variableDefinition.type;
        context.reportError(
          new GraphQLError(
            `Fragment "${spreadNode.name.value}" argument "${varName}" of type "${index.typeToString(
              argType,
            )}" is required, but it was not provided.`,
            { nodes: spreadNode },
          ),
        );
      }
    }
  }

  function validateDirective(directiveNode: DirectiveNode): void {
    validateDirectiveArguments(
      directiveNode,
      context.index.getDirectiveArgumentMap(directiveNode.name.value),
      context.index,
      (message, node) => {
        context.reportError(new GraphQLError(message, { nodes: node }));
      },
    );
  }
};

function validateDirectiveArguments(
  directiveNode: DirectiveNode,
  argDefMap:
    | ReadonlyMap<string, GraphQLArgument | InputValueDefinitionNode>
    | undefined,
  index: TypeSystemValidationIndex,
  reportError: (message: string, node: DirectiveNode) => void,
): void {
  const directiveName = directiveNode.name.value;
  if (argDefMap == null) {
    return;
  }

  let providedArgs: Set<string> | undefined;

  for (const argDef of argDefMap.values()) {
    const requiredArgName = getRequiredDirectiveArgumentName(argDef, index);
    if (requiredArgName == null) {
      continue;
    }

    providedArgs ??= getProvidedArgs(directiveNode.arguments);
    if (providedArgs?.has(requiredArgName) === true) {
      continue;
    }

    reportError(
      missingRequiredDirectiveArgumentMessage(
        directiveName,
        requiredArgName,
        getDirectiveArgumentTypeStr(argDef),
      ),
      directiveNode,
    );
  }
}

function getProvidedArgs(
  args:
    | ReadonlyArray<{ readonly name: { readonly value: string } }>
    | undefined,
): Set<string> | undefined {
  if (args == null || args.length === 0) {
    return;
  }
  const providedArgs = new Set<string>();
  for (const arg of args) {
    providedArgs.add(arg.name.value);
  }
  return providedArgs;
}

function isRequiredVariableDefinitionNode(
  arg: VariableDefinitionNode,
): boolean {
  return arg.type.kind === Kind.NON_NULL_TYPE && arg.defaultValue == null;
}

function isGraphQLArgument(arg: ArgumentReference): arg is GraphQLArgument {
  return !('kind' in arg);
}

function isRequiredArgumentNode(arg: InputValueDefinitionNode): boolean {
  return arg.type.kind === Kind.NON_NULL_TYPE && arg.defaultValue == null;
}

function getRequiredDirectiveArgumentName(
  arg: GraphQLArgument | InputValueDefinitionNode,
  index: TypeSystemValidationIndex,
): string | undefined {
  if ('kind' in arg) {
    if (!isRequiredArgumentNode(arg) || !index.isInputType(arg.type)) {
      return;
    }
    return arg.name.value;
  }

  if (!isInputType(arg.type) || !isRequiredGraphQLArgument(arg)) {
    return;
  }
  return arg.name;
}

function getDirectiveArgumentTypeStr(
  arg: GraphQLArgument | InputValueDefinitionNode,
): string {
  return 'kind' in arg ? print(arg.type) : inspect(arg.type);
}

function missingRequiredDirectiveArgumentMessage(
  directiveName: string,
  argName: string,
  argTypeStr: string,
): string {
  return `Argument "@${directiveName}(${argName}:)" of type "${argTypeStr}" is required, but it was not provided.`;
}
