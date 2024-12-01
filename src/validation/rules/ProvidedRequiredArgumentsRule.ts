import { inspect } from '../../jsutils/inspect.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type {
  InputValueDefinitionNode,
  VariableDefinitionNode,
} from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import { print } from '../../language/printer.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type { GraphQLArgument } from '../../type/definition.js';
import { isRequiredArgument, isType } from '../../type/definition.js';
import { specifiedDirectives } from '../../type/directives.js';

import { typeFromAST } from '../../utilities/typeFromAST.js';

import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext.js';

/**
 * Provided required arguments
 *
 * A field or directive is only valid if all required (non-null without a
 * default value) field arguments have been provided.
 */
export function ProvidedRequiredArgumentsRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    // eslint-disable-next-line new-cap
    ...ProvidedRequiredArgumentsOnDirectivesRule(context),
    Field: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(fieldNode) {
        const fieldDef = context.getFieldDef();
        if (!fieldDef) {
          return false;
        }

        const providedArgs = new Set(
          fieldNode.arguments?.map((arg) => arg.name.value),
        );
        for (const argDef of fieldDef.args) {
          if (!providedArgs.has(argDef.name) && isRequiredArgument(argDef)) {
            context.reportError(
              new GraphQLError(
                `Argument "${argDef}" of type "${argDef.type}" is required, but it was not provided.`,
                { nodes: fieldNode },
              ),
            );
          }
        }
      },
    },
    FragmentSpread: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(spreadNode) {
        const fragmentSignature = context.getFragmentSignature();
        if (!fragmentSignature) {
          return false;
        }

        const providedArgs = new Set(
          spreadNode.arguments?.map((arg) => arg.name.value),
        );
        for (const [
          varName,
          variableDefinition,
        ] of fragmentSignature.variableDefinitions) {
          if (
            !providedArgs.has(varName) &&
            isRequiredArgumentNode(variableDefinition)
          ) {
            const type = typeFromAST(
              context.getSchema(),
              variableDefinition.type,
            );
            const argTypeStr = inspect(type);
            context.reportError(
              new GraphQLError(
                `Fragment "${spreadNode.name.value}" argument "${varName}" of type "${argTypeStr}" is required, but it was not provided.`,
                { nodes: spreadNode },
              ),
            );
          }
        }
      },
    },
  };
}

/**
 * @internal
 */
export function ProvidedRequiredArgumentsOnDirectivesRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const requiredArgsMap = new Map<
    string,
    Map<string, GraphQLArgument | InputValueDefinitionNode>
  >();

  const schema = context.getSchema();
  const definedDirectives = schema?.getDirectives() ?? specifiedDirectives;
  for (const directive of definedDirectives) {
    requiredArgsMap.set(
      directive.name,
      new Map(
        directive.args.filter(isRequiredArgument).map((arg) => [arg.name, arg]),
      ),
    );
  }

  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      const argNodes = def.arguments ?? [];

      requiredArgsMap.set(
        def.name.value,
        new Map(
          argNodes
            .filter(isRequiredArgumentNode)
            .map((arg) => [arg.name.value, arg]),
        ),
      );
    }
  }

  return {
    Directive: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(directiveNode) {
        const directiveName = directiveNode.name.value;
        const requiredArgs = requiredArgsMap.get(directiveName);
        if (requiredArgs != null) {
          const argNodes = directiveNode.arguments ?? [];
          const argNodeMap = new Set(argNodes.map((arg) => arg.name.value));
          for (const [argName, argDef] of requiredArgs.entries()) {
            if (!argNodeMap.has(argName)) {
              const argType = isType(argDef.type)
                ? inspect(argDef.type)
                : print(argDef.type);
              context.reportError(
                new GraphQLError(
                  `Argument "@${directiveName}(${argName}:)" of type "${argType}" is required, but it was not provided.`,
                  { nodes: directiveNode },
                ),
              );
            }
          }
        }
      },
    },
  };
}

function isRequiredArgumentNode(
  arg: InputValueDefinitionNode | VariableDefinitionNode,
): boolean {
  return arg.type.kind === Kind.NON_NULL_TYPE && arg.defaultValue == null;
}
