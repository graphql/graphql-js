/** @category Validation Rules */

import { didYouMean } from '../../jsutils/didYouMean.ts';
import { suggestionList } from '../../jsutils/suggestionList.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ArgumentNode, DirectiveNode } from '../../language/ast.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Provided arguments must be defined by their field, fragment, or directive.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 * @category Validation Rules
 
 * @internal
 */
export const KnownArgumentNamesASTVisitor: ASTVisitorFn = (context) => {
  const { index, indexCursor } = context;
  let directiveDepth = 0;
  const validatedExecutableDirectives = new WeakSet<DirectiveNode>();

  const visitor: ASTVisitor = {
    Directive: {
      enter(directiveNode) {
        directiveDepth += 1;
        if (!validatedExecutableDirectives.has(directiveNode)) {
          validateDirective(directiveNode);
        }
      },
      leave() {
        directiveDepth -= 1;
      },
    },
  };

  Object.assign(visitor, {
    OperationDefinition(node) {
      validateExecutableDirectives(node.directives);
    },
    VariableDefinition(node) {
      validateExecutableDirectives(node.directives);
    },
    Field(node) {
      validateExecutableDirectives(node.directives);
    },
    FragmentSpread(node) {
      validateExecutableDirectives(node.directives);
    },
    InlineFragment(node) {
      validateExecutableDirectives(node.directives);
    },
    FragmentDefinition(node) {
      validateExecutableDirectives(node.directives);
    },
    FragmentArgument(argNode) {
      const fragmentSignature = indexCursor.getCurrentFragmentSignature();
      if (fragmentSignature == null) {
        return;
      }

      const argName = argNode.name.value;
      if (fragmentSignature.variableDefinitions.has(argName)) {
        return;
      }

      let suggestions: Array<string> = [];
      if (!context.hideSuggestions) {
        const knownArgNames = [];
        for (const varSignature of fragmentSignature.variableDefinitions.values()) {
          knownArgNames.push(varSignature.variable.name.value);
        }
        suggestions = suggestionList(argName, knownArgNames);
      }
      context.reportError(
        new GraphQLError(
          `Unknown argument "${argName}" on fragment "${fragmentSignature.definition.name.value}".` +
            didYouMean(suggestions),
          { nodes: argNode },
        ),
      );
    },
    Argument(argNode) {
      if (directiveDepth !== 0 || indexCursor.getCurrentDirective() != null) {
        return;
      }

      const argDef = indexCursor.getCurrentArgument();
      const fieldDef = indexCursor.getCurrentFieldDef();
      const parentType = indexCursor.getCurrentParentType();

      if (argDef == null && fieldDef != null) {
        const argName = argNode.name.value;
        let suggestions: Array<string> = [];
        if (!context.hideSuggestions) {
          const fieldArgs = index.getFieldArguments(fieldDef);
          if (fieldArgs != null) {
            const knownArgNames = [];
            for (const arg of fieldArgs) {
              knownArgNames.push(index.getArgumentName(arg));
            }
            suggestions = suggestionList(argName, knownArgNames);
          }
        }
        context.reportError(
          new GraphQLError(
            `Unknown argument "${argName}" on field "${index.fieldToString(
              fieldDef,
              parentType,
            )}".` + didYouMean(suggestions),
            { nodes: argNode },
          ),
        );
      }
    },
  } satisfies ASTVisitor);

  return visitor;

  function validateExecutableDirectives(
    directives: ReadonlyArray<DirectiveNode> | undefined,
  ): void {
    if (directives == null) {
      return;
    }

    for (const directiveNode of directives) {
      validatedExecutableDirectives.add(directiveNode);
      validateDirective(directiveNode);
    }
  }

  function validateDirective(directiveNode: DirectiveNode): void {
    const directiveName = directiveNode.name.value;
    validateDirectiveArguments(
      directiveNode,
      context.index.getDirectiveArgumentMap(directiveName),
      context.index.getDirectiveLocationSet(directiveName),
      context.hideSuggestions,
      (message, node) => {
        context.reportError(new GraphQLError(message, { nodes: node }));
      },
    );
  }
};

function validateDirectiveArguments(
  directiveNode: DirectiveNode,
  knownArgs: Map<string, unknown> | undefined,
  locations: ReadonlySet<string> | undefined,
  hideSuggestions: boolean,
  reportError: (message: string, node: ArgumentNode) => void,
): void {
  const args = directiveNode.arguments;
  if (args == null) {
    return;
  }

  const directiveName = directiveNode.name.value;
  if (knownArgs == null && locations == null) {
    return;
  }

  for (const argNode of args) {
    const argName = argNode.name.value;
    if (knownArgs?.has(argName) ?? false) {
      continue;
    }

    let suggestions: Array<string> = [];
    if (!hideSuggestions && knownArgs != null) {
      const knownArgNames = [];
      for (const knownArgName of knownArgs.keys()) {
        knownArgNames.push(knownArgName);
      }
      suggestions = suggestionList(argName, knownArgNames);
    }
    reportError(
      `Unknown argument "${argName}" on directive "@${directiveName}".` +
        didYouMean(suggestions),
      argNode,
    );
  }
}
